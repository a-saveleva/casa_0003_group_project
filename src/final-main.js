import './style.css'
import mapboxgl from 'mapbox-gl';
import * as d3 from 'd3';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

const travelTimeKey = import.meta.env.VITE_TRAVEL_TIME_API_KEY;
mapboxgl.accessToken = 'pk.eyJ1IjoieWFsbGxlMDUwMyIsImEiOiJjbTZpMnpoYWkwNGNlMnFzaGg2OTZ6dWcwIn0.9crGea8A_PZB83mBnq1r2w';

const Mainmap = new mapboxgl.Map({
    container: 'Mainmap',
    style: 'mapbox://styles/paneva/cmab7waoz00lc01qy1a83d8id',
    center: [-3.1, 52.058],
    zoom: 7.05
});

let originCoords = null;
let reachableStationNames = [];
let closestStationName = null;
let startStationId = null;
let endStationId = null;
const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false
});

// Document navigation
// Enable keyboard navigation for the landing page
document.addEventListener('DOMContentLoaded', () => {
    const slides = Array.from(document.querySelectorAll('section.landing-slide'));
    let currentIndex = 0;

    function scrollToSlide(index) {
        if (index >= 0 && index < slides.length) {
        slides[index].scrollIntoView({ behavior: 'smooth' });
        currentIndex = index;
        }
    }
    document.addEventListener('keydown', (event) => {
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
        switch (event.key) {
        case 'ArrowDown':
        case ' ':
            event.preventDefault();
            scrollToSlide(currentIndex + 1);
            break;

        case 'ArrowUp':
            event.preventDefault();
            scrollToSlide(currentIndex - 1);
            break;
        }
    });
});
// Enable hover and click effect for navigation buttons
const rootStyles = getComputedStyle(document.documentElement);
document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('mouseenter', () => {
        const hoverColor = rootStyles.getPropertyValue('--navbar-highlight-colour').trim();
        button.style.color = hoverColor;
        });
    
    button.addEventListener('mouseleave', () => {
        button.style.color = ''; // Resets to original color from CSS
        });

  button.addEventListener('click', () => {
    const targetId = button.getAttribute('data-target');
    const action = button.getAttribute('data-action');

    if (targetId) {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }

    if (action === 'next' || action === 'previous') {
      const slides = Array.from(document.querySelectorAll('.landing-slide'));
      const current = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      const currentSlide = slides.find(slide => slide.contains(current)) || slides[0];
      const index = slides.indexOf(currentSlide);
      let targetSlide = null;

      if (action === 'next') {
        targetSlide = slides[index + 1] || null;
      } else if (action === 'previous') {
        targetSlide = slides[index - 1] || null;
      }

      if (targetSlide) {
        targetSlide.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
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
function showAlert(message, duration = 3000) {
    const alertBox = document.getElementById('alertMessage');
    if (!alertBox) return;
    alertBox.textContent = message;
    alertBox.style.display = 'block';
    setTimeout(() => {
        alertBox.style.display = 'none';
    }, duration);
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

Mainmap.on('load', async function() {
    // Add data sources from mapbox
    Mainmap.addSource('stations', {
        type: 'vector',
        url: 'mapbox://yallle0503.9g0hkfgi'
    });
    Mainmap.addSource('edges', {
        type: 'vector',
        url: 'mapbox://yallle0503.9bgonzwv'
    });
    Mainmap.addSource('natural_assets', {
        type: 'vector',
        url: 'mapbox://yallle0503.0f6sng01'
    });
      
    // Mainmap.addSource('greenspace', {
    //     type: 'vector',
    //     url: 'mapbox://yallle0503.0f6sng01'
    // });
    Mainmap.addSource('shortest-path', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });
    
    Mainmap.addLayer({
        id: 'shortest-path-line',
        type: 'line',
        source: 'shortest-path',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#eb5c5c',
            'line-width': 3,
            'line-opacity': 0.9
        }
    });

    // ADDING CHART WITH D3
    const labels = ['Best Overall', 'Hiking', 'Cycling', 'Birdwatching', 'Seaside', 'Camping', 'Geodiversity'];
    const width = 490;
    const height = 250;
    const margin = { top: 60, right: 0, bottom: 80, left: 30 };

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
    .attr("dy", "5.5em"); // Push labels down below

    // Add styles to x-axis labels (inherit from our custom css)
    xAxisGroup.selectAll("text")
        .style("font-size", "var(--text-highlight-size)")
        .style("fill", "var(--text-highlight-color)")
        .style("font-weight", "var(--text-highlight-weight)")
        .style("font-family", "var(--text-normal-font)");

    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y));
    
    let chartTextElement;
    // Add text in the center of the chart
    chartTextElement = svg.append("text")
        .attr("x", width / 2)
        .attr("y", y(0.5))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("class", "text-normal") // Apply the CSS class

    chartTextElement = svg.append("text")
        .attr("x", width / 2)
        .attr("y", y(0.5))
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("class", "text-normal") // Apply the CSS class
        .text(""); // Start with empty text for now

    // Add the first line of text
    chartTextElement.append("tspan")
        .attr("x", width / 2)
        .attr("dy", -25)  // No vertical offset for the first line
        .text("3. Hover over a natural asset to see")
        .attr("class", "text-normal")
        .style("font-weight", 700);

    // Add the second line of text
    chartTextElement.append("tspan")
        .attr("x", width / 2)
        .attr("dy", "1.2em")  // Vertical offset to push the second line below the first
        .text(" how well it serves various activities")
        .attr("class", "text-normal")
        .style("font-weight", 700);

    chartTextElement.append("tspan")
        .attr("x", width / 2)
        .attr("dy", "1.2em")  // Vertical offset to push the second line below the first
        .text("and/or select category of interest")
        .attr("class", "text-normal")
        .style("font-weight", 700);
    
    let chartPlaceName;    
    // Add text to hold the place name at the top of the chart
    chartPlaceName = svg.append("text")
        .attr("x", 5)  // Position horizontally in the center
        .attr("y", 20)  // Position the text at the top (you can adjust this value)
        .attr("text-anchor", "left")  // Center the text horizontally
        .attr("alignment-baseline", "middle")  // Align text vertically at the middle
        .attr("class", "text-title")  // Apply the CSS class
        .text("No asset selected");  // Default text 

    // Retrieve CSS root styles once
    // Helper function to get the color for a specific category
    function getCategoryColor(category) {
        return rootStyles.getPropertyValue(`--colour-${category.toLowerCase().replace(/\s+/g, '-')}`).trim();
    }
    // Function to get top and bottom colors for a category
    function getCategoryColors(category) {
        const top = rootStyles.getPropertyValue(`--colour-${category}-top`).trim();
        const bottom = rootStyles.getPropertyValue(`--colour-${category}-bot`).trim();
        return { top, bottom };
    }

    // Function to generate stops interpolating between bottom and top color
    function generateStopsFromCSS(category, steps = 5) {
        const { top, bottom } = getCategoryColors(category);
        const interpolator = d3.interpolateRgb(bottom, top); // interpolate from bot to top

        return Array.from({ length: steps + 1 }, (_, i) => {
            const t = i / steps;
            return [t, interpolator(t)];
        }).flat();
    }

    // Generate stops dynamically for each category
    const stops_bestoverall = generateStopsFromCSS("best-overall");
    const stops_hiking = generateStopsFromCSS("hiking");
    const stops_cycling = generateStopsFromCSS("cycling");
    const stops_camping = generateStopsFromCSS("camping");
    const stops_birdwatching = generateStopsFromCSS("birdwatching");
    const stops_geodiversity = generateStopsFromCSS("geodiversity");
    const stops_coast = generateStopsFromCSS("seaside");

    // Update legend gradient dynamically
    function updateLegendGradient(category) {
        const legendGradient = document.querySelector('.legend-color.gradient');
        if (!legendGradient) return;
        const { top, bottom } = getCategoryColors(category);
        legendGradient.style.backgroundImage = `linear-gradient(to top, ${bottom}, ${top})`;
    }
    updateLegendGradient("best-overall");

    // Add buttons on top of x-axis ticks
    xAxisGroup.selectAll(".tick")
    .each(function(d, i) {
        const tick = d3.select(this);
        const label = tick.select("text");
        const labelBBox = label.node().getBBox();

        tick.append("foreignObject")
            .attr("x", labelBBox.x + labelBBox.width / 2 - 23)  // Set the x position of the button
            .attr("y", labelBBox.y - 50) // Set the y position of the button
            .attr("width", 100)  // Increased width to make it more visible
            .attr("height", 60)  // Increased height to ensure visibility
            .style("pointer-events", "all")  // Allow interaction with the button
            .append("xhtml:button")  // Use XHTML button
            .text(function() {
                // Dynamically change emoji based on the tick label
                if (labels[i] === "Best Overall") {return "🤩";
                } else if (labels[i] === "Hiking") {return "🥾";
                } else if (labels[i] === "Cycling") {return "🚴‍♂️";
                } else if (labels[i] === "Birdwatching") { return "🦆";
                } else if (labels[i] === "Seaside") {return "🏖️";
                } else if (labels[i] === "Camping") {return "⛺";
                } else if (labels[i] === "Geodiversity") {return "⛰️";
                } else {return "🤔";}  // Default emoji if something is wrong
            })
            .classed("chart-button", true) // Apply the CSS class
            .on("mouseenter", function() { // Handle hover event
                const selectedCategory = labels[i]; // Get the category from the label
                const categoryColor = getCategoryColor(selectedCategory); // Get the color for the category
                // Reset all buttons to their default border
                d3.selectAll(".chart-button").style("border", ""); // Reset to default
                // Change the border color of the hovered button
                d3.select(this).style("border", `3px solid ${categoryColor}`);
            })
            .on("mouseleave", function() { // Reset border on mouse leave
                d3.select(this).style("border", ""); // Reset to default
            })
            .on("click", function() { // Handle button click
                const selectedCategory = labels[i];  // Get the category from the label
                console.log("Selected category:", selectedCategory);

                // Reset all buttons to their default background color
                d3.selectAll(".chart-button").style("background-color", ""); // Reset to default

                // Get the color for the selected category
                const categoryColor = getCategoryColor(selectedCategory);
                // Change the clicked button's background color
                d3.select(this).style("background-color", categoryColor);
                document.getElementById('legend-category-text').textContent = `Natural assets classified by their score: ${selectedCategory}`;

                switch (selectedCategory) {
                    case 'Hiking':
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'hiking_score']], ...stops_hiking]);
                        updateLegendGradient("hiking");
                        break;
                    case 'Cycling':
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'cycling_score']], ...stops_cycling]);
                        updateLegendGradient("cycling");
                        break;
                    case 'Birdwatching':
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'birdwatching_score']], ...stops_birdwatching]);
                        updateLegendGradient("birdwatching");
                        break;
                    case 'Seaside':
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'coast_score']], ...stops_coast]);
                        updateLegendGradient("seaside");
                        break;
                    case 'Camping':
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'camping_score']], ...stops_camping]);
                        updateLegendGradient("camping");
                        break;
                    case 'Geodiversity':
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'geology_score']], ...stops_geodiversity]);
                        updateLegendGradient("geodiversity");
                        break;
                    case 'Best Overall':
                    default:
                        Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'best_overall']], ...stops_bestoverall]);
                        updateLegendGradient("best-overall");
                        break;
                }                
            });
    });

    // Add styles to the buttons
    const colorScale = d3.scaleOrdinal()
        .domain(labels) // Use the labels array
        .range([
            rootStyles.getPropertyValue('--colour-best-overall').trim(),
            rootStyles.getPropertyValue('--colour-hiking').trim(),
            rootStyles.getPropertyValue('--colour-cycling').trim(),
            rootStyles.getPropertyValue('--colour-birdwatching').trim(),
            rootStyles.getPropertyValue('--colour-seaside').trim(),
            rootStyles.getPropertyValue('--colour-camping').trim(),
            rootStyles.getPropertyValue('--colour-geodiversity').trim()
        ]);   


    // fill layer for natural assets. Default pallette shows best overall green spaces
    requestAnimationFrame(() => {
        const stops_bestoverall = generateStopsFromCSS("best-overall");
        Mainmap.addLayer({
            id: 'greenspace-fill-default',
            type: 'fill',
            source: 'natural_assets',
            'source-layer': 'natural_assets_2-9ukio1',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['to-number', ['get', 'best_overall']],
                    ...stops_bestoverall
                ],
                'fill-opacity': 0.95,
            },
            });
      });

    // // hover greenspace (on top of default)
    // Mainmap.addLayer({ 
    //     id: 'greenspace-fill-hover',
    //     type: 'line',
    //     source: 'natural_assets',
    //     'source-layer': 'natural_assets_2-9ukio1',
    //     filter: ['==', 'fid', ''],
    //     paint: {
    //         "line-width": 5,
    //         "line-color": "#5fd2ff",
    //         "line-opacity": 0,
    //         "line-offset": -2
    //     },
    // }, 'greenspace-fill-default');
    Mainmap.addLayer({ 
        id: 'greenspace-fill-hover',
        type: 'line',
        source: 'natural_assets',
        'source-layer': 'natural_assets_2-9ukio1',
        paint: {
            "line-blur": 0.8,
            "line-width": 5,
            "line-color": "#5fd2ff",
            "line-opacity": 0,
            "line-offset": -2
        },
    }, 'greenspace-fill-default');

    // Select the first button (Best Overall) by default
    const firstButton = d3.select(".chart-button");
    const defaultCategory = "Best Overall";
    const defaultColor = getCategoryColor(defaultCategory);
    // Set the background color of the first button
    firstButton.style("background-color", defaultColor);
    // Trigger the default logic for Best Overall
    Mainmap.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'best_overall'], ...stops_bestoverall]);
    console.log("Chart axis loaded");


    // 绿地 hover 效果
    let hoveredGreenspaceId = null;
    Mainmap.on('mousemove', 'greenspace-fill-default', (e) => {
        if (e.features.length > 0) {
            Mainmap.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            console.log("Feature properties:", feature.properties);
            const fid = feature.properties?.fid;

            // // Use centroid for popup placement (safer than raw coordinates)
            // const coordinates = turf.center(feature).geometry.coordinates;
            // const name = feature.properties.name || "Unnamed";

            // // Show popup
            // popup.setLngLat(coordinates)
            //     .setHTML(`<text-highlight>${name}</text-highlight>`)
            //     .addTo(map);

            if (hoveredGreenspaceId !== null) {
                Mainmap.setFilter('greenspace-fill-hover', ['==', 'fid', '']);
            }
            if (fid !== undefined && fid !== null) {
                hoveredGreenspaceId = fid;
                Mainmap.setFilter('greenspace-fill-hover', ['==', 'fid', hoveredGreenspaceId]);
                Mainmap.setPaintProperty('greenspace-fill-hover', 'line-opacity', 1); // Highlight the hovered green space
    
            
        }
            // Hide the chart prompt text on mousemove
            if (chartTextElement) {chartTextElement.style("opacity", 0);}
            // Change place name in chart
            if (chartPlaceName) {chartPlaceName.text(feature.properties?.name);}
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
                .attr("fill", d => d >= 0 ? "#42A5F5" : "#E57373")
                .attr("fill", (d, i) => colorScale(labels[i])); // Assign color based on the label
        
            bars.transition()
                .ease(d3.easeCubic)
                .duration(110)
                .attr("y", d => y(d))
                .attr("height", d => Math.abs(y(d) - y(0)));

        }
    });
    Mainmap.on('mouseleave', 'greenspace-fill-default', () => {
        // popup.remove();
        Mainmap.getCanvas().style.cursor = '';
        Mainmap.setFilter('greenspace-fill-hover', ['==', 'fid', '']);
        Mainmap.setPaintProperty('greenspace-fill-hover', 'line-opacity', 0);
        
        // Set back visibility of the chart prompt text on mouseleave
        if (chartTextElement) {chartTextElement.style("opacity", 1);}
        // Reset the chart place name
        if (chartPlaceName) {chartPlaceName.text("No green space selected");}

        hoveredGreenspaceId = null;
        Mainmap.getCanvas().style.cursor = ''; // Reset cursor to default
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

    Mainmap.on('click', 'greenspace-fill-default', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0]; // Get the clicked feature
            const coordinates = turf.center(feature).geometry.coordinates; // Get the center of the feature
    
            // Zoom to the feature
            Mainmap.flyTo({
                center: coordinates,
                zoom: 14, // Adjust the zoom level as needed
                essential: true // This ensures the animation is user-friendly
            });
    
            console.log("Zooming to feature:", feature.properties?.name || "Unnamed Feature");
        }
    });

    // 3. 添加车站和线路图层
    // (1) 全部车站（默认灰色）
    Mainmap.addLayer({
        id: 'stations-circle',
        type: 'circle',
        source: 'stations',
        'source-layer': '505network_nodes-bv54ia',
        paint: {
            'circle-color': '#888',
            'circle-radius': 3,
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        }
    });

    // (2) 高亮车站（蓝色，isochrone内）
  Mainmap.addLayer({
        id: 'stations-highlighted',
        type: 'circle',
        source: 'stations',
        'source-layer': '505network_nodes-bv54ia',
        paint: {
            'circle-color': '#42A5F5',
            'circle-radius': 4,
            'circle-opacity': 1,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff'
        },
        filter: ['in', ['get', 'name'], ['literal', []]]
    });
    // (6) 绿地关联的高亮车站(蓝色)
    Mainmap.addLayer({
        id: 'highlighted-station2',
        type: 'circle',
        source: 'stations',
        'source-layer': '505network_nodes-bv54ia',
        paint: {
            'circle-color': '#42A5F5',
            'circle-radius': 6,
            'circle-opacity': 1,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff'
        },
        filter: ['==', 'name', '']
    });
    // (3) 出发车站（橙色）
    Mainmap.addLayer({
        id: 'origin-station',
        type: 'circle',
        source: 'stations',
        'source-layer': '505network_nodes-bv54ia',
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
    Mainmap.addLayer({
        id: 'edges-line',
        type: 'line',
        source: 'edges',
        'source-layer': '505network_edges-8juinw',
        paint: {
            'line-color': '#ccc',
            'line-opacity': 0.3,
            'line-width': 2
        }
    });


    // 4. 车站悬停弹窗
    function setupStationHover(layerId) {
        Mainmap.on('mouseenter', layerId, (e) => {
            Mainmap.getCanvas().style.cursor = 'pointer';
            const feature = e.features[0];
            const coordinates = feature.geometry.coordinates.slice();
            const name = getStationIdentifier(feature);
            popup.setLngLat(coordinates)
                 .setHTML(`<strong>${name}</strong>`)
                 .addTo(Mainmap);
        });

        Mainmap.on('mouseleave', layerId, () => {
            Mainmap.getCanvas().style.cursor = '';
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
    .setLngLat(Mainmap.getCenter())
    .addTo(Mainmap);

    originCoords = originMarker.getLngLat();

    originMarker.on('dragend', async () => {
        originCoords = originMarker.getLngLat();
        const minutes = timeRange.value;
        const travelTime = parseInt(minutes) * 60;
    
        const closest = await findClosestStation(originCoords);
        closestStationName = getStationIdentifier(closest);
    
        if (closestStationName) {
            Mainmap.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
            console.log("Closest station:", closestStationName);
            document.getElementById("originStationName").textContent = closestStationName;
        }
    
        // ✅ 新增：设置起点 ID 并尝试绘制路径
        if (closest && closest.properties && closest.properties.id !== undefined) {
            startStationId = closest.properties.id;
            updatePathIfReady();  // ✅ 尝试绘制路线（如果 endStationId 已设置）
        }

       Mainmap.flyTo({
            center: originCoords, // Coordinates of the marker
            zoom: 9, 
            essential: true, // Ensures the animation is user-friendly
            offset: [window.innerWidth / 8, 0]
        });

        updateIsochrone(travelTime, originCoords);  // 原有等时线功能保留
        updateDebugInfo();
    });

    const button = document.getElementById('randomizer-button');
    document.getElementById('randomizer-button').addEventListener('click', () => {
        // Generate a random travel time between 5 and 240 minutes
        const randomTime = Math.floor(Math.random() * (240 - 15 + 1)) + 15;
    
        // Update the slider value and the displayed time
        timeRange.value = randomTime;
        document.getElementById('timeValue').textContent = `${randomTime} minutes`;

        const stationFeatures = Mainmap.querySourceFeatures('stations', { 
            sourceLayer: '505network_nodes-bv54ia'
        });
    
        if (stationFeatures.length > 0) {
            const randomStation = stationFeatures[Math.floor(Math.random() * stationFeatures.length)];
            
            const randomCoords = randomStation.geometry.coordinates;
            originMarker.setLngLat(randomCoords); // Move the marker to the random station
            originCoords = originMarker.getLngLat();
            Mainmap.flyTo({
                center: randomCoords, // Coordinates of the marker
                zoom: 9, 
                essential: true, // Ensures the animation is user-friendly
                offset: [window.innerWidth / 8, 0]
            });
    
            closestStationName = getStationIdentifier(randomStation);
            document.getElementById("originStationName").textContent = closestStationName;
    
            // Update the isochrone with the new travel time and coordinates
            const travelTime = randomTime * 60;
            updateIsochrone(travelTime, originCoords);
    
            console.log(`Random station selected: ${closestStationName}`);
        } else {
            console.warn("No stations found in the source layer.");
        }
    });

    button.addEventListener('mouseover', function () {this.style.border = '3px solid grey';});
    button.addEventListener('mouseout', function () {this.style.border = '1px solid grey';});

    const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        marker: false,
        countries: 'gb',
        placeholder: 'or search for an origin'
      });
      
    // Append the geocoder to a specific container
    document.getElementById('geocoder-container').appendChild(geocoder.onAdd(map));

    // Add event listener for geocoder result
    geocoder.on('result', (event) => {
        const selectedCoords = event.result.geometry.coordinates;
        originMarker.setLngLat(selectedCoords);
        originCoords = { lng: selectedCoords[0], lat: selectedCoords[1] };

        Mainmap.flyTo({
            center: selectedCoords,
            zoom: 9, // Adjust the zoom level as needed
            essential: true, // Ensures the animation is user-friendly
            offset: [window.innerWidth / 8, 0] // Adjust for menus on the left
        });

        findClosestStation(originCoords).then((closest) => {
            closestStationName = getStationIdentifier(closest);
            if (closestStationName) {
                Mainmap.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
                document.getElementById("originStationName").textContent = closestStationName;
            }
        });

        const travelTime = parseInt(timeRange.value) * 60; // Convert minutes to seconds
        updateIsochrone(travelTime, originCoords);
    });
    
    // 6. 绿地悬停效果
    async function findClosestStationToGreenSpace(greenSpaceId) {
        try {
            // 获取绿地特征
            const greenSpaceFeatures = Mainmap.querySourceFeatures('natural_assets', {
                sourceLayer: 'natural_assets-2q506d',
                filter: ['==', 'fid', greenSpaceId]
            });
            
            if (!greenSpaceFeatures || greenSpaceFeatures.length === 0) {
                console.warn("未找到ID为", greenSpaceId, "的绿地");
                return null;
            }

            const greenSpace = greenSpaceFeatures[0];
            
            // 验证几何数据
            if (!greenSpace.geometry || !greenSpace.geometry.coordinates) {
                console.warn("绿地几何数据无效:", greenSpace);
                return null;
            }

            // 计算中心点坐标
            let centerCoords;
            try {
                const center = turf.centroid(greenSpace.geometry);
                centerCoords = center.geometry.coordinates;
            } catch (e) {
                console.warn("使用第一个坐标作为后备中心点");
                // 如果计算中心点失败，使用第一个坐标作为近似中心
                if (Array.isArray(greenSpace.geometry.coordinates[0][0])) {
                    centerCoords = greenSpace.geometry.coordinates[0][0];
                } else {
                    centerCoords = greenSpace.geometry.coordinates[0];
                }
            }

            // 获取所有车站
            const stationFeatures = Mainmap.querySourceFeatures('stations', {
                sourceLayer: '505network_nodes-bv54ia'
            });

            if (!stationFeatures || stationFeatures.length === 0) {
                console.warn("未找到车站数据");
                return null;
            }

            // 查找最近车站
            let closestStation = null;
            let minDistance = Infinity;

            stationFeatures.forEach(station => {
                try {
                    if (!station.geometry || !station.geometry.coordinates) {
                        console.warn("车站坐标缺失:", station);
                        return;
                    }
                    
                    const distance = turf.distance(
                        turf.point(station.geometry.coordinates),
                        turf.point(centerCoords)
                    );
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStation = station;
                    }
                } catch (e) {
                    console.warn("处理车站时出错:", station, e);
                }
            });

            return closestStation;
        } catch (error) {
            console.error("查找离绿地最近车站时出错:", error);
            return null;
        }
    }

    async function highlightStationOnHover(greenSpaceId) {
        try {
            const closestStation = await findClosestStationToGreenSpace(greenSpaceId);
            
            if (!closestStation) {
                console.warn("未找到绿地", greenSpaceId, "附近的车站");
                return;
            }

            const stationName = getStationIdentifier(closestStation);
            if (closestStation && closestStation.properties && closestStation.properties.id !== undefined) {
                endStationId = closestStation.properties.id;
                updatePathIfReady();
            }

            // 设置过滤器来高亮显示车站
            Mainmap.setFilter('highlighted-station2', ['==', 'name', stationName]);

            console.log("高亮车站:", stationName, "对应绿地:", greenSpaceId);
            
        } catch (error) {
            console.error("高亮车站时出错:", error);
            showAlert("高亮车站时出错");
        }
    }

    // 绿地悬停事件
    Mainmap.on('mousemove', 'greenspace-fill-default', async (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const greenSpaceId = feature.properties?.fid;

            if (greenSpaceId !== undefined && greenSpaceId !== null) {
                await highlightStationOnHover(greenSpaceId);
            }
        }
    });

    // 鼠标离开绿地时清除高亮
    Mainmap.on('mouseleave', 'greenspace-fill-default', () => {
        Mainmap.setFilter('highlighted-station2', ['==', 'name', '']);
    });

    // 7. 初始化
    const closest = await findClosestStation(originCoords);
    closestStationName = getStationIdentifier(closest);

    if (closestStationName) {
        Mainmap.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
    }

    updateDebugInfo();
});
    // 初始化时更新一次
    const minutes = timeRange.value;
    const travelTime = parseInt(minutes) * 60;

    const closest = await findClosestStation(originCoords);
    closestStationName = getStationIdentifier(closest);

    // if (closestStationName) {
    //     Mainmap.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
    // }

    // updateIsochrone(travelTime, originCoords);
    // updateDebugInfo();
    // 辅助函数：查找最近车站
async function findClosestStation(coords) {
    const features = Mainmap.querySourceFeatures('stations', {
        sourceLayer: '505network_nodes-bv54ia'
    });

    let closestStation = null;
    let minDistance = Infinity;

    features.forEach(function(station) {
        const stationCoords = turf.point(station.geometry.coordinates);
        const distance = turf.distance(stationCoords, turf.point([coords.lng, coords.lat]));

        if (distance < minDistance) {
            minDistance = distance;
            closestStation = station;
        }
    });

    return closestStation;
}

async function updatePathIfReady() {
    if (startStationId !== null && endStationId !== null) {
        try {
            const res = await fetch(`http://127.0.0.1:5000/shortest-path?start_id=${startStationId}&end_id=${endStationId}`);
            const geojson = await res.json();
            const source = Mainmap.getSource('shortest-path');
            if (!source) {
                console.warn("shortest-path source not found yet.");
                return;
            }

            if (geojson.error) {
                console.warn("路径计算失败：", geojson.error);
                showAlert("路径加载失败");
                return;
            }

// 动画前先清空原始路径数据
source.setData({
    type: "FeatureCollection",
    features: []
});


            if (geojson.error) {
                console.warn("路径计算失败：", geojson.error);
                showAlert("路径加载失败");
                return;
            }

            // 动画效果绘线
            animateLine(geojson.geometry.coordinates);

        } catch (err) {
            console.error("请求路径出错：", err);
            showAlert("路径加载失败");
        }
    }
}
//动画
function animateLine(coordinates) {
    let i = 0;
    let frameCounter = 0;
    const total = coordinates.length;

    const line = {
        type: "Feature",
        geometry: {
            type: "LineString",
            coordinates: []
        },
        properties: {}
    };

    function draw() {
        if (i < total) {
            if (frameCounter % 3 === 0) {  // 每 3 帧推进一次
                line.geometry.coordinates.push(coordinates[i]);
                Mainmap.getSource('shortest-path').setData({
                    type: "FeatureCollection",
                    features: [line]
                });
                i++;
            }
            frameCounter++;
            requestAnimationFrame(draw);
        }
    }

    draw();
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

            if (Mainmap.getSource("isochrone")) {
                Mainmap.removeLayer("isochrone-layer");
                Mainmap.removeSource("isochrone");
            }

            if (features.length > 0) {
                Mainmap.addSource("isochrone", {
                    type: "geojson",
                    data: {
                        type: "FeatureCollection",
                        features: features
                    }
                });

                Mainmap.addLayer({
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



// ===== Section 2 Interaction Script =====

function initSection2Interaction() {

let scrollStage = 0;        // 当前第几幕
let scrollDistance = 0;     // 当前卡片已上浮的像素距离
const scrollThreshold = 2000; // 每张卡片完全上浮所需的总距离（例如 8次×20）
const perScrollStep = 200;    // 每次滚轮滑动卡片移动距离

const cards = document.querySelectorAll('.card');
let activeCard = null;

window.addEventListener('scroll', () => {
  const viewportCenter = window.innerHeight / 2;

  let closest = null;
  let minDist = Infinity;

  cards.forEach(card => {
    const rect = card.getBoundingClientRect();
    const cardCenter = rect.top + rect.height / 2;
    const dist = Math.abs(viewportCenter - cardCenter);

    if (dist < minDist) {
      minDist = dist;
      closest = card;
    }
  });

  if (closest && closest !== activeCard) {
    cards.forEach(c => c.classList.remove('active'));
    closest.classList.add('active');
    activeCard = closest;

    const step = +closest.dataset.step;
    if (flySteps[step]) flySteps[step]();  // ✅ 地图联动
  }
});


    const tooltip = d3.select('#tooltip');
    // 全局存储 features, 供 handleHover 调用
    const cityCoords = {
  London:      [-0.02, 51.30],
  Manchester:  [-2.24, 53.48],
  Birmingham:  [-1.90, 52.48],
  Bristol:     [-2.59, 51.45],
  Sheffield:   [-1.47, 53.38],
  Nottingham:  [-1.15, 52.95],
    Glasgow:     [-4.25, 55.86],     // ✅ 格拉斯哥
  Edinburgh:   [-3.19, 55.95]      // ✅ 爱丁堡
};

  let sortedFeatures = [];
  let recs;  // ✅ 全局变量声明

  // 1. 初始化 Mapbox
  mapboxgl.accessToken = 'pk.eyJ1IjoieWFsbGxlMDUwMyIsImEiOiJjbTZpMnpoYWkwNGNlMnFzaGg2OTZ6dWcwIn0.9crGea8A_PZB83mBnq1r2w';
  const section2Map  = new mapboxgl.Map({
    container:'map-section2',
    style:'mapbox://styles/yallle0503/cmahdvqg000xm01qy0m3v0y55',
    center:[-1.5,53.1],
    zoom:6.1,
    pitch: 35,     // ⬅️ 倾斜角，0是垂直俯视，最大60
    bearing: -30,  // ⬅️ 顺时针旋转角度，负值表示向左偏转
    scrollZoom: false  // ⛔ 禁止默认滚轮缩放
  });

  const colorMap = {
    30:'#c3b602',
    60:'#d49c03',
    90:'#ca6104',
    120:'#af023c'
  };


  section2Map .on('load', async () => {
    
    // 2. 加载 GeoJSON 并绘制等时圈 / edges / stations
    const resp = await fetch('all_isochrone1.geojson');
    const js   = await resp.json();
    const feats = js.features.filter(f=>!f.properties.id.startsWith('Leeds'));

    sortedFeatures = feats;
    

     section2Map .addSource('iso', {
      type:'geojson',
      data:{ type:'FeatureCollection', features:sortedFeatures }
     });
    const durations = ['120min','90min','60min','30min'];
    durations.forEach(dur => {
      const ids = sortedFeatures
        .filter(f=>f.properties.id.endsWith(dur))
        .msection2Map (f=>f.properties.id);

      section2Map .addLayer({
        id:`iso-fill-${dur}`, type:'fill', source:'iso',
        filter:['match',['get','id'],ids,true,false],
         paint:{ 'fill-color':colorMap[+dur.replace('min','')], 'fill-opacity':0.2 }
      }, 'waterway-label');

      section2Map .addLayer({
        id:`iso-line-${dur}`, type:'line', source:'iso',
        filter:['match',['get','id'],ids,true,false],
        paint:{ 'line-color':colorMap[+dur.replace('min','')], 'line-width':1.2, 'line-opacity':0.8 }
      }, 'waterway-label');
    })

    section2Map .addSource('edges',{type:'vector',url:'mapbox://yallle0503.9bgonzwv'});
    section2Map .addLayer({
      id:'edges-line', type:'line', source:'edges', 'source-layer':'505network_edges-8juinw',
      paint:{
        'line-color':'#1e6bb3',
        'line-width':['interpolate',['linear'],['zoom'],3,0.5,8,1,13,1.5],
        'line-opacity':0.8
      }
    });

    section2Map.addSource('stations',{type:'vector',url:'mapbox://yallle0503.9g0hkfgi'});
    section2Map.addLayer({
      id:'stations-circle', type:'circle', source:'stations', 'source-layer':'505network_nodes-bv54ia',
      paint:{
        'circle-color':'#1e6bb3',
        'circle-radius':['interpolate',['linear'],['zoom'],4,0.25,6,1,13,4],
        'circle-opacity':0.8,
        'circle-stroke-width':0.8,
        'circle-stroke-color': '#ffffff'   
      }
    });
    fetch('green_assets_merged_avg_area.geojson')
  .then(res => res.json())
  .then(data => {
    section2Map.addSource('all-points', {
      type: 'geojson',
      data: data
    });

    section2Map.addLayer({
      id: 'all-points-layer',
      type: 'circle',
      source: 'all-points',
      paint: {
        'circle-radius':['interpolate',['linear'],['zoom'],4,1,6,1.8,13,3],
        'circle-color': '#3EA46E',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 0.4
      },
      filter: ['==', '$type', 'Point']
    });
    
// ✅ 图层添加后立刻隐藏
    section2Map.setLayoutProperty('all-points-layer', 'visibility', 'none');
  });
  //隐藏图层 
  // ✅ 初始隐藏所有图层
  section2Map.setLayoutProperty('edges-line', 'visibility', 'none');
  section2Map.setLayoutProperty('stations-circle', 'visibility', 'none');

  ['30min','60min','90min','120min'].forEach(dur => {
    section2Map.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'none');
    section2Map.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'none');
  });
  //开关
  // 铁路图层开关
document.getElementById('rail-toggle').addEventListener('change', function(e) {
  const visible = e.target.checked ? 'visible' : 'none';
 section2Map.setLayoutProperty('edges-line', 'visibility', visible);
  section2Map.setLayoutProperty('stations-circle', 'visibility', visible);
});

// 绿色图层开关
document.getElementById('green-toggle').addEventListener('change', function(e) {
  const visible = e.target.checked ? 'visible' : 'none';
  if (section2Map.getLayer('all-points-layer')) {
    section2Map.setLayoutProperty('all-points-layer', 'visibility', visible);
  }
});


    // 5) 鼠标 hover 城市时高亮对应等时圈
    durations.forEach(dur => {
      section2Map.on('mousemove', `iso-fill-${dur}`, handleHover);
      section2Map.on('mouseleave', `iso-fill-${dur}`, restoreAllLayers);
    });

    // 6) 图层开关（保持原样）
    document.querySelectorAll('#layer-toggle input[type=checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const fillId = `iso-fill-${cb.value}`;
        const lineId = `iso-line-${cb.value}`;
        const vis = cb.checked ? 'visible' : 'none';
        if (section2Map.getLayer(fillId)) section2Map.setLayoutProperty(fillId,'visibility',vis);
        if (section2Map.getLayer(lineId)) section2Map.setLayoutProperty(lineId,'visibility',vis);
      });
    });

  
    
  // 在这里添加
  d3.select('#controls').style('display', 'none');      // 城市按钮
  d3.select('#layer-toggle').style('display', 'none'); // 图层选择框

// ✅ 构造 recs 数据（在 section2Map.on('load') 内）
recs = sortedFeatures.map(f => {
  const [city, dRaw] = f.properties.id.split('_');
  const dur = +dRaw.replace('min', '');
  return {
    props: f.properties,
    city: city,
    x: f.properties.total_points + (Math.random() - 0.5) * 4,
    y: Math.round(f.properties.total_green_area_buffered / 1e6),
    color: colorMap[dur]
  };
});



// ✅ 再生成城市按钮（必须在 recs 初始化后）
const ctrl = d3.select('#controls');
const cities = Array.from(new Set(recs.map(r => r.city)));
cities.forEach(c => {
  ctrl.append('button')
    .text(c)
    .attr('class', 'city-btn')
    .on('click', function () {
      d3.selectAll('.city-btn').classed('active', false);
      d3.select(this).classed('active', true);
      filterCity(c);
      if (cityCoords[c]) {
        section2Map.flyTo({
          center: cityCoords[c],
          zoom: 8.5,
          speed: 0.8,
          curve: 1.5,
          essential: true
        });
      }
    });
});

// ✅ 添加 Show All 按钮
ctrl.append('button')
  .text('Show All')
  .attr('class', 'city-btn')
  .on('click', function () {
    d3.selectAll('.city-btn').classed('active', false);
    d3.select(this).classed('active', true);
    filterCity(null);
  });

scrollStage = 0;
scrollDistance = 0;

cardContainer.innerHTML = '';
showNewCard(scrollStage);         // ✅ 正确显示第一张卡片动画
updateMapAndCard(scrollStage);   // ✅ 同步第一幕图层（轨道、车站等）


});

  //文本
  function updateStoryBox(stage) {
  const box = document.getElementById('story-box');
  const text = storyTexts[stage] || '';

  if (text) {
    box.innerHTML = text;
    box.classList.add('show');
  } else {
    box.classList.remove('show');
  }
}


  // ============================
  // drawBubbleChart 完整版本
  function drawBubbleChart(data) {
    // 清空
    d3.select('#bubble-chart').selectAll('*').remove();
    const margin = {l:50, r:20, t:10, b:30};
    const totalW = document.getElementById('bubble-chart').clientWidth;
    const totalH = document.getElementById('bubble-chart').clientHeight;
    const W = totalW - margin.l - margin.r;
    const H = totalH - margin.t - margin.b;

    const svg = d3.select('#bubble-chart')
      .append('svg')
        .attr('width', totalW)
        .attr('height', totalH)
      .append('g')
        .attr('transform', `translate(${margin.l},${margin.t})`);

    // scales
    const maxX = d3.max(data, d=>d.x),
          maxY = d3.max(data, d=>d.y),
          minY = d3.min(data, d=>d.y);

    const xScale = d3.scaleLinear().domain([0, maxX+20]).range([0, W]);
    const yScale = d3.scaleLinear().domain([minY-600, maxY+200]).range([H, 0]);

    // 气泡节点
    const nodes = data.map(d=>({
    props: d.props,      // ← 一定要保留这一行
    city: d.city,
    cx: xScale(d.x),
    cy: yScale(d.y),
    r: 10,
    color: d.color
  }));

    // 圆
    // **在 on('mouseover') 中，用 function(event,d) 拿到第二个参数 d**
    svg.selectAll('circle').data(nodes).join('circle')
      .attr('cx',d=>d.cx).attr('cy',d=>d.cy).attr('r',d=>d.r)
      .attr('fill',d=>d.color).attr('fill-opacity',0.5)
      .attr('stroke',d=>d.color).attr('stroke-width',2)
      .style('cursor','pointer')
      .on('mouseover', function(event, d) {
        // 放大
        d3.select(this)
          .transition().duration(200)
          .attr('r', d.r * 2.5);

        // **tooltip.style 现在是 d3 selection，正常可用**
        tooltip.html(
          `City: ${d.city}<br>`+
          `Points: ${d.props.total_points}<br>`+
          `Area: ${Math.round(d.props.total_green_area_buffered/1e6)} km²`
        )
        .style('left',  (event.pageX+10) + 'px')
        .style('top',   (event.pageY+10) + 'px')
        .style('visibility','visible');
        // 画 Donut
        drawRadialChart(d.props);
        })
        .on('mousemove', event=>{
          tooltip.style('left',(event.pageX+10)+'px')
                 .style('top',(event.pageY+10)+'px');
        })
        .on('mouseout', function(event, d) {
          d3.select(this).transition().duration(200).attr('r', d.r);
          tooltip.style('visibility','hidden');
          d3.select('#radial-chart svg').remove();
        });

    // 文本标签
    const labels = svg.selectAll('text.label').data(nodes).join('text')
      .attr('class','label')
      .text(d=>d.city)
      .attr('fill',   d=>d.color)
      .attr('stroke','#000')      // 黑色描边
      .attr('stroke-width',0.5)
      .style('paint-order','stroke')
      .attr('font-size',11)
      .attr('text-anchor','middle')
      .attr('x', d=>d.cx)
      .attr('y', d=>d.cy);

    // D3 力导避让
    d3.forceSimulation(nodes)
      .force('x',      d3.forceX(d=>d.cx).strength(0.1))
      .force('y',      d3.forceY(d=>d.cy).strength(0.1))
      .force('collide',d3.forceCollide(d=>d.r+8))
      .force('charge', d3.forceManyBody().strength(-5))
      .on('tick', ()=>{
        labels
          .attr('x', d=>d.x)
          .attr('y', d=>d.y);
      });

    // --- 坐标轴最后画，保证在最顶层 ---
    const axisColor = '#3e63c9';

    const xg = svg.append('g')
      .attr('transform', `translate(0,${H})`)
      .call(d3.axisBottom(xScale).ticks(5));
    const yg = svg.append('g')
      .call(d3.axisLeft(yScale).ticks(5));

    // 提升到最上层
    svg.selectAll('.x.axis, .y.axis').raise();

    // 应用颜色
    xg.selectAll('path').attr('stroke',axisColor);
    xg.selectAll('line').attr('stroke',axisColor);
    xg.selectAll('text').attr('fill', axisColor);

    yg.selectAll('path').attr('stroke',axisColor);
    yg.selectAll('line').attr('stroke',axisColor);
    yg.selectAll('text').attr('fill', axisColor);
    // 添加横轴标题：Points
svg.append('text')
  .attr('x', W / 2)
  .attr('y', H + 28)
  .attr('text-anchor', 'middle')
  .style('font-size', '12px')
  .style('fill', axisColor)
  .text('Points');

// 添加纵轴标题：Area
svg.append('text')
  .attr('transform', 'rotate(-90)')
  .attr('x', -H / 3)
  .attr('y', -30)
  .attr('text-anchor', 'middle')
  .style('font-size', '12px')
  .style('fill', axisColor)
  .text('Area (km²)');


    // 暴露给 filter
    window._nodes  = nodes;
    window._labels = labels;
  }
  //
 function drawRadialChart(props) {
  const keys = [
    'parks','nature_reserves','protected_areas',
    'wood','scrub','wetlands','gardens',
    'forests','grassland','beaches','heaths'
  ];

  const data = keys.map(k => ({
    label: k.replace(/_/g, ' '),
    value: +props[k] || 0
  })).filter(d => d.value > 0)
    .sort((a, b) => a.value - b.value);

  const barH = 12;
  const pad = 10;
  const innerR = 25;
  const margin = 65;
  const labelX = -100;
  const labelFont = 12;
  const maxAngle = 1.5 * Math.PI; // ⬅️ 最多 3/4 圆
  const maxV = d3.max(data, d => d.value) || 1;

  const layers = data.length;
  const outerR = innerR + layers * (barH + pad);
  const W = outerR * 2 + margin * 2;
  const H = outerR * 2 + margin * 2;

  const colorScale = d3.scaleLinear()
    .domain([4, 6, 12, 22])
    .range(['#c3b602','#d49c03','#ca6104','#af023c'])
    .clamp(true);

  const sel = d3.select('#radial-chart').html('');
  const svg = sel.append('svg')
    .attr('width', W)
    .attr('height', H)
    .append('g')
    .attr('transform', `translate(${W/2}, ${H/2})`);

  const startA = 0 ;
  
  data.forEach((d, i) => {
    const frac = d.value / maxV;
    const endA = startA + maxAngle * frac;
    const r0 = innerR + i * (barH + pad);
    const r1 = r0 + barH;

    // 弧形条
    svg.append('path')
      .attr('d', d3.arc()
        .innerRadius(r0)
        .outerRadius(r1)
        .startAngle(startA)
        .endAngle(endA)
        .cornerRadius(barH / 2)
      )
      .attr('fill', colorScale(d.value))
      .attr('fill-opacity', 0.7);
    });

    // 左上角文字
    const reversedData = [...data].reverse();

    reversedData.forEach((d, i) => {
  svg.append('text')
    .attr('x', labelX)
    .attr('y', -outerR + i * (barH + pad) + barH / 2)
    .attr('dy', '0.35em')
    .style('font', `${labelFont}px sans-serif`)
    .style('fill', colorScale(d.value))
    .text(`${d.label} ${d.value}`);
});
}




  function filterCity(city) {
    d3.selectAll('#bubble-chart circle')
      .attr('opacity', function(d){
        return city ? (d3.select(this).datum().city===city?1:0.1) : 1;
      });
    window._labels
      .attr('opacity', d=> city? (d.city===city?1:0.1):1 );
  }

  function handleHover(e){
   section2Map.getCanvas().style.cursor = 'pointer';
    if(!e.features||!e.features.length) return;
    const hoveredId = e.features[0].properties.id;
    const cityPrefix = hoveredId.split('_')[0];
    const idsToShow = sortedFeatures
      .filter(f=>f.properties.id.startsWith(cityPrefix))
      .map(f=>f.properties.id);
    ['30min','60min','90min','120min'].forEach(dur=>{
      const showIds = idsToShow.filter(id=>id.endsWith(dur));
      section2Map.setFilter(`iso-fill-${dur}`, ['match',['get','id'],showIds,true,false]);
      section2Map.setFilter(`iso-line-${dur}`, ['match',['get','id'],showIds,true,false]);
    });
  }

  function restoreAllLayers(){
    section2Map.getCanvas().style.cursor = '';
    ['30min','60min','90min','120min'].forEach(dur=>{
      const ids = sortedFeatures
        .filter(f=>f.properties.id.endsWith(dur))
        .map(f=>f.properties.id);
      section2Map.setFilter(`iso-fill-${dur}`, ['match',['get','id'],ids,true,false]);
      section2Map.setFilter(`iso-line-${dur}`, ['match',['get','id'],ids,true,false]);
    });
  }
  let introCleared = false;


  const activityData = [
    { rank: 1, activity: "Hiking" },
    { rank: 2, activity: "Cycling" },
    { rank: 3, activity: "Birdwatching" },
    { rank: 4, activity: "Camping" },
    { rank: 5, activity: "Stargazing" },
    { rank: 6, activity: "Wildlife\nphotography" },
    { rank: 7, activity: "Berry picking" },
    { rank: 8, activity: "Swimming " },
    { rank: 9, activity: "Trail\nrunning " },
    { rank: 10, activity: "Leaf peeping" }
  ];

  function drawActivityBubbles() {
    const container = document.getElementById('activity-bubbles');
  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3.select('#activity-bubbles')
  .append('svg')
  .attr('width', width)
  .attr('height', height);
    

    const radiusScale = d3.scaleLinear().domain([1, 10]).range([80, 30]);
    const colorScale = d3.scaleSequential()
  .domain([10, 1])
  .interpolator(d3.interpolateRgb("#c3b602", "#af023c")); // 红 → 黄

    const fontSizeScale = d3.scaleLinear()
    .domain([1, 10])     // rank 从 1 到 10
    .range([15, 8]);    // 字体从大到小（可以调整）
    const simulation = d3.forceSimulation(activityData)
      .force("x", d3.forceX(window.innerWidth / 2).strength(0.05))
      .force("y", d3.forceY(window.innerHeight / 2).strength(0.05))
      .force("collide", d3.forceCollide(d => radiusScale(d.rank) + 10))
      .on("tick", ticked);

    const nodes = svg.selectAll('g')
      .data(activityData)
      .enter()
      .append('g')
      .style('opacity', 0)
      .transition().duration(800)
      .delay((d, i) => i * 80)
      .style('opacity', 1);

    const group = svg.selectAll('g')
      .data(activityData);

    group.append('circle')
       .attr('r', 0)  // 从半径 0 开始
  .attr('fill', d => colorScale(d.rank))
  .attr('stroke', '#fff')
  .attr('stroke-width', 2)
  .transition()
  .duration(800)
  .ease(d3.easeBounceOut)  // 弹跳感效果
  .attr('r', d => radiusScale(d.rank))  // 最终大小
      .attr('fill-opacity', 0.7);
    

    const texts = group.append('text')
  .attr('text-anchor', 'middle')
  .style('fill', '#fff')
  .style('font-size', d => fontSizeScale(d.rank) + 'px');

texts.each(function(d) {
  const lines = d.activity.split('\n');
  lines.forEach((line, i) => {
    d3.select(this).append('tspan')
      .text(line)
      .attr('x', 0)
      .attr('dy', i === 0 ? '0.35em' : '1.2em');
  });
});


    function ticked() {
      group.attr('transform', d => `translate(${d.x},${d.y})`);
    }
  }
window.addEventListener('wheel', function () {
  if (!introCleared) {
    introCleared = true;
    const cover = document.getElementById('intro-cover');
    cover.style.opacity = '0';
    document.getElementById('activity-bubbles').style.opacity = '0';  // 淡出泡泡图
setTimeout(() => {
  cover.style.display = 'none';
  document.getElementById('activity-bubbles').remove();  // 完全移除
}, 1000);
  }
}, { once: true });
drawActivityBubbles();  // ⬅️ 页面一加载就执行
//柱形图
const activities = [
  { type: "Urban green space", percent: 52, activity: "Walking & Relaxing" },
  { type: "Forest", percent: 32, activity: "Hiking" },
  { type: "Fields / Farmland", percent: 32, activity: "Picnicking" },
  { type: "River/Lake/Canal", percent: 30, activity: "Swimming" },
  { type: "Beach/Coast/Sea", percent: 28, activity: "Coastal Walk" }
];

const svg = d3.select("#activity-chart");
const width = document.getElementById("activity-lines").clientWidth;
const height = document.getElementById("activity-lines").clientHeight;
const margin = { top: 250, right: 40, bottom: 20, left: 60 };
const lineLen = width * 0.6;
const rowH = 90;
svg.append("text")
  .attr("x", width * 0.34)  // ⬅️ 控制水平方向
  .attr("y", margin.top * 0.55)  // ⬅️ 控制垂直位置
  .attr("fill", "white")
  .attr("font-size", "25px")
  .attr("font-weight", "bold")
  .attr("text-anchor", "middle")
  .style("pointer-events", "all")
  .selectAll("tspan")
  .data([
    "What are the most frequently visited",
    "nature destinations ?"
  ])
  .enter()
  .append("tspan")
  // ⬇️ 删除 .attr("x")，只设置相对垂直偏移
  .attr("x", width * 0.34)         // 每行保持相同 x
  .attr("dy", (d, i) => i === 0 ? "0em" : "1.3em")  // 垂直间距
  .text(d => d);


const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

const color = "#af023c";
activities.forEach((d, i) => {
  const y = i * rowH;
  const group = g.append("g");
  const targetX = lineLen * (d.percent / 100);
  // 1. 白线
  group.append("line")
    .attr("x1", 0).attr("x2", lineLen)
    .attr("y1", y).attr("y2", y)
    .attr("stroke", "white")
    .attr("stroke-width", 2);

  // 2. 红色泡泡 + 动画 + hover
  const circle = group.append("circle")
    .datum(d)
    .attr("cx", 0)
    .attr("cy", y)
    .attr("r", 9)
    .attr("fill", color)
    .style("cursor", "pointer")
    .style("opacity", 0.7);

  // 🚀 执行动画
  circle.transition()
  .duration(2500)
  .attr("cx", targetX)
  .on("end", function(_, i) {
    d3.select(this)
      .on("mouseover", function(event, d) {
        tooltip.style("visibility", "visible")
          .style("left", `${event.pageX + 10}px`)
          .style("top", `${event.pageY - 20}px`)
          .html(`<b>${d.type}</b><br>${d.activity}`);
      })
      .on("mouseout", () => {
        tooltip.style("visibility", "hidden");
      });
  });


  

  // 3. 上方文字（类型）✅ 白色
  group.append("text")
    .text(d.type)
    .attr("x", targetX)
    .attr("y", y - 15)
    .attr("fill", "white")
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("opacity", 0)
    .transition()
    .delay(1500)
    .style("opacity", 1);

  // 4. 下方文字（百分比）✅ 白色
  group.append("text")
    .text(d.percent + "%")
    .attr("x", targetX)
    .attr("y", y + 25)
    .attr("fill", "white")
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("opacity", 0)
    .transition()
    .delay(1200)
    .style("opacity", 1);
});


let lastScrollTime = 0;
let scrollCount = 0;


// ✅ 放在你的 main.js 或 <script> 上部
const cardContainer = document.getElementById('card-container');
const textData = [
  "🚆 Britain's rail system is among the densest in Europe. Trains link cities with remarkable speed and frequency—laying the foundation for exploring green spaces near and far.",
  "⏱️ 30-minute Accessibility",
  "⏱️ 60-minute Expansion",
  "⏱️ 90-minute Reach",
  "⏱️ 120-minute Full Ring",
  "📊 Compare with Bubble Chart",
  "📍 Fly to London",
  "📍 Fly to Glasgow",
  "📍 Back to National View"
];
const maxStage = textData.length - 1;  //

  setTimeout(() => {
    newCard.style.transform = 'translate(-50%, 0)';
    newCard.style.opacity = 1;
  }, 10);


window.addEventListener('wheel', function (e) {
  e.preventDefault();
  const direction = e.deltaY > 0 ? 1 : -1;
  scrollDistance += direction * perScrollStep;

  // 防止 scrollDistance < 0，尤其在 stage === 0 时向上滚
  scrollDistance = Math.max(0, scrollDistance);

  // ✅ 只更新“上一张卡片”
  const allCards = document.querySelectorAll('.card');
  allCards.forEach((card) => {
    const cardStage = Number(card.getAttribute('data-stage'));
    if (cardStage === scrollStage - 1) {
      card.style.transform = `translate(-50%, -${scrollDistance}px)`;
      card.style.opacity = 1 - (scrollDistance / scrollThreshold) * 0.8;
    }
  });

  // ✅ 向下滑动：进入下一幕
  if (scrollDistance >= scrollThreshold && scrollStage < maxStage) {
    scrollDistance = 0;
    scrollStage++;
    updateMapAndCard(scrollStage);
    showNewCard(scrollStage);
  }

  // ✅ 向上滑动：回到上一幕
  if (direction < 0 && scrollDistance === 0 && scrollStage > 0) {
    scrollStage--;
    scrollDistance = scrollThreshold;  // ✅ 模拟上一张卡片还未浮出的状态
    updateMapAndCard(scrollStage);
    showNewCard(scrollStage);
  }
}, { passive: false });


function showNewCard(stage) {
  const newCard = document.createElement('div');
  newCard.className = 'card';
  newCard.innerHTML = textData[stage] || `Stage ${stage}`;
  newCard.style.transform = 'translate(-50%, 100vh)';
  newCard.style.opacity = 0;
  newCard.style.visibility = 'hidden'; 
  newCard.setAttribute('data-stage', stage);

  cardContainer.appendChild(newCard);

  // 上浮动画
  setTimeout(() => {
    newCard.style.visibility = 'visible';   
    newCard.style.transform = 'translate(-50%, 0px)';
    newCard.style.opacity = 1;
  }, 20);

  // 清理旧卡片（保留 2 张以内）
  const all = document.querySelectorAll('.card');
  if (all.length > 3) {
    all[0].remove();
  }
  scrollDistance = 0;

}


function updateMapAndCard(stage) {
  // ✅ 统一清除旧图层
section2Map.setLayoutProperty('edges-line', 'visibility', 'none');
  section2Map.setLayoutProperty('stations-circle', 'visibility', 'none');
  ['30min','60min','90min','120min'].forEach(dur => {
    section2Map.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'none');
    section2Map.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'none');
  });
  section2Map.setLayoutProperty('all-points-layer', 'visibility', 'none');
  d3.select('#bubble-chart').style('display', 'none');
  d3.select('#controls').style('display', 'none');
  d3.select('#layer-toggle').style('display', 'none');

  // ✅ 分幕控制地图和图层
  if (stage === 1) {
    section2Map.setLayoutProperty('edges-line', 'visibility', 'visible');
    section2Map.setLayoutProperty('stations-circle', 'visibility', 'visible');
    Mainmap.jumpTo({  center: [-1.5, 53.1], zoom: 6.2  });

  } else if (stage === 2) {
    section2Map.setLayoutProperty('iso-fill-30min', 'visibility', 'visible');
    section2Map.setLayoutProperty('iso-line-30min', 'visibility', 'visible');
    Mainmap.jumpTo({  center: [-1.5, 53.1], zoom: 6.2 });

  } else if (stage === 3) {
    section2Map.setLayoutProperty('iso-fill-60min', 'visibility', 'visible');
    section2Map.setLayoutProperty('iso-line-60min', 'visibility', 'visible');
    Mainmap.jumpTo({ center: [-1.5, 53.1], zoom: 6.2 });

  } else if (stage === 4) {
    section2Map.setLayoutProperty('iso-fill-90min', 'visibility', 'visible');
    section2Map.setLayoutProperty('iso-line-90min', 'visibility', 'visible');
    Mainmap.jumpTo({ center: [-1.5, 53.1], zoom: 6.2 });

  } else if (stage === 5) {
    section2Map.setLayoutProperty('iso-fill-120min', 'visibility', 'visible');
    section2Map.setLayoutProperty('iso-line-120min', 'visibility', 'visible');
    Mainmap.jumpTo({ center: [-1.5, 53.1], zoom: 6.2 });

  } else if (stage === 6) {
    ['30min','60min','90min','120min'].forEach(dur => {
      section2Map.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
      section2Map.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
    });
    section2Map.setLayoutProperty('all-points-layer', 'visibility', 'visible');
    section2Map.flyTo({ center: [-0.0076, 51.2072], zoom: 8.1 });

    setTimeout(() => {
      d3.select('#bubble-chart').style('display', 'block');
      d3.select('#controls').style('display', 'block');
      d3.select('#layer-toggle').style('display', 'block');

      setTimeout(() => {
        drawBubbleChart(recs);
        d3.selectAll('.city-btn').classed('active', false);
        d3.select('#controls button').filter(function() {
          return this.textContent === 'Show All';
        }).classed('active', true);
        filterCity(null);
      }, 100);
    }, 200);

  

  } else if (stage === 7) {
  // ✅ 重新开启所有等时圈
  ['30min','60min','90min','120min'].forEach(dur => {
    section2Map.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
    section2Map.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
  });
  
  section2Map.setLayoutProperty('all-points-layer', 'visibility', 'visible');

  section2Map.flyTo({ center: [-3.3518, 55.9642], zoom: 8.5 });

  setTimeout(() => {
    d3.select('#bubble-chart').style('display', 'block');
    d3.select('#controls').style('display', 'block');
    d3.select('#layer-toggle').style('display', 'block');

    setTimeout(() => {
      drawBubbleChart(recs);
      d3.selectAll('.city-btn').classed('active', false);
      d3.select('#controls button').filter(function() {
        return this.textContent === 'Show All';
      }).classed('active', true);
      filterCity(null);
    }, 100);
  }, 200);
}else if (stage === 8) {
  // ✅ 同样开启所有图层
  ['30min','60min','90min','120min'].forEach(dur => {
    section2Map.setLayoutProperty(`iso-fill-${dur}`, 'visibility', 'visible');
    section2Map.setLayoutProperty(`iso-line-${dur}`, 'visibility', 'visible');
  });
  
  section2Map.setLayoutProperty('all-points-layer', 'visibility', 'visible');

  section2Map.flyTo({ center: [-1.5, 52.6], zoom: 6.1 });

  setTimeout(() => {
    d3.select('#bubble-chart').style('display', 'block');
    d3.select('#controls').style('display', 'block');
    d3.select('#layer-toggle').style('display', 'block');

    setTimeout(() => {
      drawBubbleChart(recs);
      d3.selectAll('.city-btn').classed('active', false);
      d3.select('#controls button').filter(function() {
        return this.textContent === 'Show All';
      }).classed('active', true);
      filterCity(null);
    }, 100);
  }, 200);
  
}
  
}


}

document.addEventListener('DOMContentLoaded', initSection2Interaction);
