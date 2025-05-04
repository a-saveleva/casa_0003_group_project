import './style.css'
import mapboxgl from 'mapbox-gl';
import * as d3 from 'd3';

const travelTimeKey = import.meta.env.VITE_TRAVEL_TIME_API_KEY;
mapboxgl.accessToken = 'pk.eyJ1IjoieWFsbGxlMDUwMyIsImEiOiJjbTZpMnpoYWkwNGNlMnFzaGg2OTZ6dWcwIn0.9crGea8A_PZB83mBnq1r2w';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/yallle0503/cm99w4avp000c01sahtj70ith',
    center: [-0.1276, 51.5072],
    zoom: 10
});

let originCoords = null;
let reachableStationNames = [];
let closestStationName = null;
const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

// Get station identifier
function getStationIdentifier(station) {
    return station.properties?.name || 'Unnamed Station_' + (station.id || Math.random().toString(36).substr(2, 9));
}

// Debug info
function updateDebugInfo() {
    document.getElementById('debugInfo').innerHTML = `
        <div>Closest Station: ${closestStationName || 'Not selected'}</div>
        <div>Reachable Stations: ${reachableStationNames.length}</div>
    `;
}

// Slider control
const timeRange = document.getElementById('timeRange');
timeRange.addEventListener('input', function() {
    document.getElementById('timeValue').textContent = `${this.value} minutes`;
    if (originCoords) {
        const travelTime = parseInt(this.value) * 60;
        updateIsochrone(travelTime, originCoords);
    }
});

map.on('load', async function() {
    // 1. Add data sources from mapbox
    map.addSource('stations', {
        type: 'vector',
        url: 'mapbox://yallle0503.10evu8w5'
    });
    map.addSource('edges', {
        type: 'vector',
        url: 'mapbox://yallle0503.1qo5b74k'
    });
    map.addSource('natural_assets', {
        type: 'vector',
        url: 'mapbox://yallle0503.4lbkc4fp'
    });
    map.addSource('greenspace', {
        type: 'vector',
        url: 'mapbox://yallle0503.1kf0p7om'
    });

    // Add chart container
    const labels = ['Best Overall', 'Hiking', 'Cycling', 'Birdwatching', 'Seaside', 'Camping', 'Geodiversity'];
    const width = 700;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 80, left: 30 };

    // Create SVG and scales
    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const x = d3.scaleBand()
        .domain(labels) // Use the labels array for x-axis
        .range([margin.left, width - margin.right]) // Adjusted to fit within the SVG
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Draw axis
    const xAxisGroup = svg.append("g") // Create a group for x-axis
        .attr("transform", `translate(0,${y(0)})`) // Position at the bottom of the chart
        .call(d3.axisBottom(x)); // Add x-axis

    xAxisGroup.selectAll(".tick line").remove(); // Remove ticks

    xAxisGroup.selectAll("text")
    .attr("dy", "5em"); // Push labels down below

    // Add styles to x-axis labels (inherit from our custom css)
    xAxisGroup.selectAll("text")
        .style("font-size", "var(--text-highlight-size)")
        .style("fill", "var(--text-highlight-color)")
        .style("font-weight", "var(--text-highlight-weight)")
        .style("font-family", "var(--text-normal-font)");

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y));
    
    let chartTextElement;

    // Add text in the center of the chart
    chartTextElement = svg.append("text")
        .attr("x", width / 2)
        .attr("y", y(0.5))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("class", "text-normal") // Apply the CSS class
        .text("Hover over a green space to see the scores");

    // Add buttons on top of x-axis ticks
    // Add buttons on top of x-axis ticks (replace radio buttons with regular rectangular buttons)
    xAxisGroup.selectAll(".tick")
    .each(function(d, i) {
        const tick = d3.select(this);
        const label = tick.select("text");
        const labelBBox = label.node().getBBox();

        // Add a button instead of the radio button
        tick.append("foreignObject")
            .attr("x", labelBBox.x + labelBBox.width / 2 - 20)  // Set the x position of the button
            .attr("y", labelBBox.y - 43) // Set the y position of the button
            .attr("width", 100)  // Increased width to make it more visible
            .attr("height", 60)  // Increased height to ensure visibility
            .style("pointer-events", "all")  // Allow interaction with the button
            .append("xhtml:button")  // Use XHTML button
            .text(function() {
                // Dynamically change emoji based on the tick label
                if (labels[i] === "Best Overall") {
                    return "🤩";
                } else if (labels[i] === "Hiking") {
                    return "🥾";
                } else if (labels[i] === "Cycling") {
                    return "🚴‍♂️";
                } else if (labels[i] === "Birdwatching") {
                    return "🦆";
                } else if (labels[i] === "Seaside") {
                    return "🏖️";
                } else if (labels[i] === "Camping") {
                    return "⛺";
                } else if (labels[i] === "Geodiversity") {
                    return "⛰️";
                } else {
                    return "🤔";  // Default emoji for other categories
                }
            })
            .classed("chart-button", true)  // Apply the CSS class here
            .on("click", function() {
                const selectedCategory = labels[i];  // Get the category from the label
                console.log("Selected category:", selectedCategory);

                switch (selectedCategory) {
                    case 'Hiking':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'hiking_score'], ...stops_hiking]);
                        break;
                    case 'Cycling':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'cycling_score'], ...stops_cycling]);
                        break;
                    case 'Birdwatching':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'birdwatching_score'], ...stops_birdwatching]);
                        break;
                    case 'Seaside':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'coast_score'], ...stops_coast]);
                        break;
                    case 'Camping':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'camping_score'], ...stops_camping]);
                        break;
                    case 'Geodiversity':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'geology_score'], ...stops_geodiversity]);
                        break;
                    case 'Best Overall':
                    default:
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'best_overall_score'], ...stops_bestoverall]);
                        break;
                }
            });
    });

    console.log("Chart axis loaded");
        
    //Make colour maps for all categories
    function generateStops(interpolator, maxValue = 1, steps = 5) {
        const scale = d3.scaleSequential(interpolator).domain([0, 0.75]);
        return Array.from({ length: steps + 1 }, (_, i) => {
            const t = i / steps;
            return [t, scale(t)];
        }).flat();
    }
    // Annd do the following later after more work on the source has been done.
    // make sure the pallettes work with the data - currently there are a lot of white polygons
    // This will be addressed by changing the data in the source
    const stops_bestoverall = generateStops(d3.interpolatePuRd);
    const stops_hiking        = generateStops(d3.interpolateOrRd);
    const stops_cycling       = generateStops(d3.interpolateYlGn);
    const stops_camping       = generateStops(d3.interpolateGreens);
    const stops_birdwatching  = generateStops(d3.interpolateRdPu);
    const stops_geodiversity  = generateStops(d3.interpolateCividis);
    const stops_coast         = generateStops(d3.interpolateYlGnBu);

    // fill layer for natural parks and heritage coast
    map.addLayer({
        id: 'nationalParks-fill',
        type: 'fill',
        source: 'greenspace',
        'source-layer': 'greenspace-635xeg',
        paint: {
            'fill-color': [
                'case',
                ['==', ['get', 'sourse'], 'national-parks'], '#81C784',
                ['==', ['get', 'sourse'], 'heritage-coast'], '#81C784',
                'transparent'
            ],
            'fill-opacity': 0.5,
        },
    });  

    // fill layer for natural assets. Default pallette shows best overall green spaces
    map.addLayer({
    id: 'greenspace-fill-default',
    type: 'fill',
    source: 'natural_assets',
    'source-layer': 'natural_assets-2q506d',
    paint: {
        'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'birdwatching_score'],
            ...stops_bestoverall
        ],
        'fill-opacity': 0.85,
    },
    // minzoom: 0,
    });

    // line layer for natural parks and heritage coast
    // map.addLayer({
    //     id: 'nationalParks-line',
    //     type: 'line',
    //     source: 'greenspace',
    //     'source-layer': 'greenspace-635xeg',
    //     paint: {
    //         'line-color': [
    //             'case',
    //             ['==', ['get', 'sourse'], 'national-parks'], '#2E7D32',
    //             ['==', ['get', 'sourse'], 'heritage-coast'], '#2E7D32',
    //             'transparent'
    //         ],
    //         // 'line-width': 2
    //     }
    // });  


    // (2) hover greenspace (on top of default)
    map.addLayer({
        id: 'greenspace-fill-hover',
        type: 'fill',
        source: 'natural_assets',
        'source-layer': 'natural_assets-2q506d',
        paint: {
            'fill-color': '#D6D6D0',
            'fill-opacity': 0.7,
            'fill-outline-color': '#2E7D32'
        },
        minzoom: 5
    }, 'greenspace-fill-default');

    // 绿地 hover 效果
    let hoveredGreenspaceId = null;
    map.on('mousemove', 'greenspace-fill-default', (e) => {
        if (e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            console.log("Feature properties:", feature.properties);
            const fid = feature.properties?.fid;
            if (hoveredGreenspaceId !== null) {
                map.setFilter('greenspace-fill-hover', ['==', 'fid', '']);
            }
            if (fid !== undefined && fid !== null) {
                hoveredGreenspaceId = fid;
                map.setFilter('greenspace-fill-hover', ['==', 'fid', hoveredGreenspaceId]);
            }
            // Hide the chart prompt text on mousemove
            if (chartTextElement) {chartTextElement.style("opacity", 0);}
            // On hover display category scores
            const chart_data = [
                // first is placeholder for best overall
                feature.properties.hiking_score, 
                feature.properties.hiking_score,
                feature.properties.cycling_score,
                feature.properties.birdwatching_score,
                feature.properties.coast_score,
                feature.properties.camping_score,
                feature.properties.geology_score];

            const bars = svg.selectAll(".bar")
                .data(chart_data)
                .enter()
                .append("rect")
                .attr("class", "bar")
                .attr("x", (d, i) => x(labels[i]))
                .attr("y", y(0))  // start from y=0
                .attr("height", 0) // start from height=0
                .attr("width", x.bandwidth())
                .attr("fill", d => d >= 0 ? "#42A5F5" : "#E57373");

            bars.transition()
                .ease(d3.easeCubic)
                .duration(110)
                .attr("y", d => y(d))
                .attr("height", d => Math.abs(y(d) - y(0)));

        }
    });
    map.on('mouseleave', 'greenspace-fill-default', () => {

        // Set back visibility of the chart prompt text on mouseleave
        if (chartTextElement) {chartTextElement.style("opacity", 1);}
        map.setFilter('greenspace-fill-hover', ['==', 'fid', '']);
        hoveredGreenspaceId = null;
        map.getCanvas().style.cursor = ''; // Reset cursor to default
        // Reset the chart container
        const bars = svg.selectAll(".bar");
        bars.transition()
            .ease(d3.easeCubic)
            .duration(90)
            .attr("y", y(0))
            .attr("height", 0)
            .on("end", function() {
                d3.select(this).remove(); // Remove each bar after animation
        });
    });

    // 3. 添加车站和线路图层
    // (1) 全部车站（默认灰色）
    map.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        'source-layer': '416network_nodes-clxu30',
        paint: {
            'circle-color': '#888',
            'circle-radius': 3,
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        }
    });

    // (2) 高亮车站（蓝色，isochrone内）
    map.addLayer({
        id: 'stations-highlighted',
        type: 'circle',
        source: 'stations',
        'source-layer': '416network_nodes-clxu30',
        paint: {
            'circle-color': '#42A5F5',
            'circle-radius': 4,
            'circle-opacity': 1,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        },
        filter: ['in', ['get', 'name'], ['literal', []]]
    });

    // (3) 出发车站（橙色）
    map.addLayer({
        id: 'origin-station',
        type: 'circle',
        source: 'stations',
        'source-layer': '416network_nodes-clxu30',
        paint: {
            'circle-color': '#FF5722',
            'circle-radius': 4,
            'circle-opacity': 1,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        },
        filter: ['==', ['get', 'name'], '']
    });

    // (4) 所有路线
    map.addLayer({
        id: 'edges-line',
        type: 'line',
        source: 'edges',
        'source-layer': '416network_edges-3lf9g8',
        paint: {
            'line-color': '#ccc',
            'line-opacity': 0.3,
            'line-width': 2
        }
    });

    // (5) 高亮路线
    map.addLayer({
        id: 'highlighted-edge',
        type: 'line',
        source: 'edges',
        'source-layer': '416network_edges-3lf9g8',
        paint: {
            'line-color': '#FF3C38',
            'line-width': 4
        },
        filter: ['in', 'id', '']
    });

    // 4. 车站悬停弹窗
    function setupStationHover(layerId) {
        map.on('mouseenter', layerId, (e) => {
            map.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const name = getStationIdentifier(feature);
            popup.setLngLat(coordinates)
                 .setHTML(`<strong>${name}</strong>`)
                 .addTo(map);
        });

        map.on('mouseleave', layerId, () => {
            map.getCanvas().style.cursor = '';
            popup.remove();
        });
    }
    setupStationHover('stations-circle');
    setupStationHover('stations-highlighted');
    setupStationHover('origin-station');

    // 5. 可拖动出发点 Marker
    const originMarker = new mapboxgl.Marker({
        draggable: true,
        color: "#E57373"
    })
    .setLngLat(map.getCenter())
    .addTo(map);

    originCoords = originMarker.getLngLat();

    originMarker.on('dragend', async () => {
        originCoords = originMarker.getLngLat();
        const minutes = timeRange.value;
        const travelTime = parseInt(minutes) * 60;

        const closest = await findClosestStation(originCoords);
        closestStationName = getStationIdentifier(closest);

        if (closestStationName) {
            map.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
        }

        updateIsochrone(travelTime, originCoords);
        updateDebugInfo();
    });

    // 初始化时更新一次
    const minutes = timeRange.value;
    const travelTime = parseInt(minutes) * 60;

    const closest = await findClosestStation(originCoords);
    closestStationName = getStationIdentifier(closest);

    if (closestStationName) {
        map.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
    }

    updateIsochrone(travelTime, originCoords);
    updateDebugInfo();

    // 6. 定义工具函数
    async function findClosestStation(coords) {
        const features = map.querySourceFeatures('stations', {
            sourceLayer: '416network_nodes-clxu30'
        });

        let closestStations = [];
        let closestDistance = Infinity;
        const DISTANCE_TOLERANCE = 0.1;

        features.forEach(station => {
            const distance = turf.distance(
                turf.point([coords.lng, coords.lat]),
                turf.point(station.geometry.coordinates)
            );

            if (distance < closestDistance + DISTANCE_TOLERANCE) {
                if (distance < closestDistance) {
                    closestStations = [station];
                    closestDistance = distance;
                } else {
                    closestStations.push(station);
                }
            }
        });

        console.log("Closest stations:", closestStations.map(s => ({
            name: getStationIdentifier(s),
            distance: closestDistance.toFixed(2) + 'km'
        })));

        return closestStations[0];
    }

    async function updateIsochrone(travelTime, coords) {
        try {
            const res = await fetch("https://api.traveltimeapp.com/v4/time-map", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Application-Id": "2b79ce8a",
                    "X-Api-Key": travelTimeKey
                },
                body: JSON.stringify({
                    departure_searches: [{
                        id: "isochrone_1",
                        coords: coords,
                        departure_time: new Date().toISOString(),
                        travel_time: travelTime,
                        transportation: { type: "driving+train" },
                        level_of_detail: { scale_type: "simple", level: "medium" },
                        remove_water_bodies: true,
                        render_mode: "approximate_time_filter"
                    }]
                })
            });

            const data = await res.json();
            const shapes = data.results?.[0]?.shapes || [];

            const features = shapes.map(shape => ({
                type: "Feature",
                geometry: {
                    type: "Polygon",
                    coordinates: [shape.shell.map(p => [p.lng, p.lat])]
                },
                properties: {}
            }));

            if (map.getSource("isochrone")) {
                map.removeLayer("isochrone-layer");
                map.removeSource("isochrone");
            }

            if (features.length > 0) {
                map.addSource("isochrone", {
                    type: "geojson",
                    data: {
                        type: "FeatureCollection",
                        features: features
                    }
                });

                map.addLayer({
                    id: "isochrone-layer",
                    type: "fill",
                    source: "isochrone",
                    paint: {
                        "fill-color": "#007BFF",
                        "fill-opacity": 0.3,
                        "fill-outline-color": "#007BFF"
                    }
                });

                highlightStationsWithinIsochrone(features);
            }
        } catch (err) {
            console.error("Isochrone request failed", err);
        }
    }

    function highlightStationsWithinIsochrone(isochroneFeatures) {
        if (!isochroneFeatures.length || !originCoords) return;

        const mergedPolygon = turf.combine(
            turf.featureCollection(isochroneFeatures)
        ).features[0];

        const BUFFER_DISTANCE = 0.05;
        const bufferedPolygon = turf.buffer(mergedPolygon, BUFFER_DISTANCE, {units: 'kilometers'});

        const features = map.querySourceFeatures('stations', {
            sourceLayer: '416network_nodes-clxu30'
        });

        const reachable = features.filter(f => {
            const stationName = getStationIdentifier(f);
            if (!stationName || stationName === closestStationName) return false;

            return turf.booleanPointInPolygon(
                turf.point(f.geometry.coordinates),
                bufferedPolygon
            );
        });

        reachableStationNames = [...new Set(
            reachable.map(f => getStationIdentifier(f))
        )].filter(Boolean);

        console.log("Reachable stations:", reachableStationNames);

        if (reachableStationNames.length > 0) {
            map.setFilter('stations-highlighted', ['in', ['get', 'name'], ['literal', reachableStationNames]]);
        } else {
            map.setFilter('stations-highlighted', ['==', ['get', 'name'], '']);
        }

        updateDebugInfo();

        // Hover 时高亮路线
        let hoveredStationId = null;

        map.on('mousemove', 'stations-highlighted', (e) => {
            const hoverStationName = getStationIdentifier(e.features[0]);
            if (!reachableStationNames.includes(hoverStationName)) return;

            hoveredStationId = hoverStationName;

            map.setFilter('highlighted-edge', ['any',
                ['all',
                    ['==', ['get', 'from'], closestStationName],
                    ['==', ['get', 'to'], hoveredStationId]
                ],
                ['all',
                    ['==', ['get', 'to'], closestStationName],
                    ['==', ['get', 'from'], hoveredStationId]
                ]
            ]);
        });

        map.on('mouseleave', 'stations-highlighted', () => {
            hoveredStationId = null;
            map.setFilter('highlighted-edge', ['in', 'id', '']);
        });
    }
});
