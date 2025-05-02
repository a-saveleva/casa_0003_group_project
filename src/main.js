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
    // 1. Add data sources
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

    // 1.1 Add chart container
    const labels = ['Hiking', 'Cycling', 'Birdwatching', 'Coast Leisure', 'Camping', 'Geodiversity'];
    const width = 500;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 20, left: 30 };
    
    const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);
    
    const x = d3.scaleBand()
    .domain(labels)
    .range([margin.left, width - margin.right])
    .padding(0.2);
    
    const y = d3.scaleLinear()
    .domain([0, 1])
    .nice()
    .range([height - margin.bottom, margin.top]);
    
    svg.append("g")
    .attr("transform", `translate(0,${y(0)})`)
    .call(d3.axisBottom(x));
    
    svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y));

    console.log("Chart axis loaded");
    
    //Make colour maps for all categories
    const steps = 5;
    function generateStops(interpolator, maxValue = 1, steps = 5) {
        const scale = d3.scaleSequential(interpolator).domain([0, 0.75]);
        return Array.from({ length: steps + 1 }, (_, i) => {
            const t = i / steps;
            return [t, scale(t)];
        }).flat();
    }
    
    const stops_bestoverall = generateStops(d3.interpolatePuRd);
    const stops_hiking        = generateStops(d3.interpolateOrRd);
    const stops_cycling       = generateStops(d3.interpolateYlGn);
    const stops_camping       = generateStops(d3.interpolateGreens);
    const stops_birdwatching  = generateStops(d3.interpolateRdPu);
    const stops_geodiversity  = generateStops(d3.interpolateCividis);
    const stops_coast         = generateStops(d3.interpolateYlGnBu);

    // 2. Add base map layers
    // (1) Gray greenspace (base layer, default gray)
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
        filter: ['==', 'fid', ''],
        minzoom: 5
    }, 'greenspace-fill-default');

    // add radio buttons to switch between categories
    const radios = document.querySelectorAll('input[name="layers"]');

    radios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            const selectedCategoryDisplay = e.target.value;
            console.log("Selected layer:", selectedCategoryDisplay);

            // Example: show/hide layers based on value
            switch (selectedCategoryDisplay) {
                case 'option1':
                    map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'],['get', 'hiking_score'], ...stops_hiking]);
                    break;
                case 'option2':
                    map.setPaintProperty('EngWal_Hex_Emp', 'fill-extrusion-opacity', 0);
                    map.setPaintProperty('EngWal_Hex_Res', 'fill-extrusion-opacity', 0.95);
                    break;
            // Add more cases for option3 to option6 as needed
            }
        });
    });

    // 绿地 hover 效果
    let hoveredGreenspaceId = null;
    map.on('mousemove', 'greenspace-fill-default', (e) => {
        if (e.features.length > 0) {
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
            // On hover display category scores
            const chart_data = [
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
