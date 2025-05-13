import './style.css'
import mapboxgl from 'mapbox-gl';
import * as d3 from 'd3';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

// ✅ 第一行先声明变量
let hasSecondMapInitialized = false;

window.addEventListener('DOMContentLoaded', () => {
  const section2 = document.getElementById('section2');
  if (!section2) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasSecondMapInitialized) {
        hasSecondMapInitialized = true;

        import('./section2_init.js')
          .then(() => console.log('✅ section2_init.js loaded'))
          .catch(err => console.error('❌ Failed to load section2_init.js:', err));
      }
    });
  }, { threshold: 0.3 });

  observer.observe(section2);
});

const travelTimeKey = import.meta.env.VITE_TRAVEL_TIME_API_KEY;
mapboxgl.accessToken = 'pk.eyJ1IjoieWFsbGxlMDUwMyIsImEiOiJjbTZpMnpoYWkwNGNlMnFzaGg2OTZ6dWcwIn0.9crGea8A_PZB83mBnq1r2w';

const map = new mapboxgl.Map({
    container: 'map',
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


window.addEventListener('DOMContentLoaded', () => {
  const section2 = document.getElementById('section2');
  if (!section2) {
    console.warn("⚠️ section2 not found in DOM");
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasSecondMapInitialized) {
        hasSecondMapInitialized = true;
        console.log('📍 Section 2 entered — calling initSecondMap()');
        initSecondMap();
      }
    });
  }, { threshold: 0.4 });

  observer.observe(section2);
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

map.on('load', async function() {
    // Add data sources from mapbox
    map.addSource('stations', {
        type: 'vector',
        url: 'mapbox://yallle0503.9g0hkfgi'
    });
    map.addSource('edges', {
        type: 'vector',
        url: 'mapbox://yallle0503.9bgonzwv'
    });
    map.addSource('natural_assets', {
        type: 'vector',
        url: 'mapbox://yallle0503.0f6sng01'
    });
      
    // map.addSource('greenspace', {
    //     type: 'vector',
    //     url: 'mapbox://yallle0503.0f6sng01'
    // });
    map.addSource('shortest-path', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });
    
    map.addLayer({
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
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'hiking_score']], ...stops_hiking]);
                        updateLegendGradient("hiking");
                        break;
                    case 'Cycling':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'cycling_score']], ...stops_cycling]);
                        updateLegendGradient("cycling");
                        break;
                    case 'Birdwatching':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'birdwatching_score']], ...stops_birdwatching]);
                        updateLegendGradient("birdwatching");
                        break;
                    case 'Seaside':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'coast_score']], ...stops_coast]);
                        updateLegendGradient("seaside");
                        break;
                    case 'Camping':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'camping_score']], ...stops_camping]);
                        updateLegendGradient("camping");
                        break;
                    case 'Geodiversity':
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'geology_score']], ...stops_geodiversity]);
                        updateLegendGradient("geodiversity");
                        break;
                    case 'Best Overall':
                    default:
                        map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['to-number', ['get', 'best_overall']], ...stops_bestoverall]);
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
        map.addLayer({
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
            // const rootStyles = getComputedStyle(document.documentElement);
        const highlightColor = rootStyles.getPropertyValue('--navbar-highlight-colour').trim();
        map.addLayer({
            id: 'greenspace-zoomedline',
            type: 'line',
            source: 'natural_assets',
            'source-layer': 'natural_assets_2-9ukio1',
            filter: ['==', 'fid', ''],
            paint: {
                "line-width": 3,
                "line-color": highlightColor,
                // "line-opacity": 1,
                "line-offset": -2,
            },
        });      
        const highlightAsset = rootStyles.getPropertyValue('--natural-asset-highlight').trim();
        // hover greenspace (on top of default)
        map.addLayer({ 
            id: 'greenspace-fill-hover',
            type: 'line',
            source: 'natural_assets',
            'source-layer': 'natural_assets_2-9ukio1',
            filter: ['==', 'fid', ''],
            paint: {
                "line-width": 4,
                "line-color": highlightAsset,
                // "line-opacity": 0,
                "line-offset": -2,
            },
        }, 'greenspace-fill-default');
    });

    // Select the first button (Best Overall) by default
    const firstButton = d3.select(".chart-button");
    const defaultCategory = "Best Overall";
    const defaultColor = getCategoryColor(defaultCategory);
    // Set the background color of the first button
    firstButton.style("background-color", defaultColor);
    // Trigger the default logic for Best Overall
    map.setPaintProperty('greenspace-fill-default', 'fill-color', ['interpolate', ['linear'], ['get', 'best_overall'], ...stops_bestoverall]);
    console.log("Chart axis loaded");


    // 绿地 hover 效果
    let hoveredGreenspaceId = null;
    map.on('mousemove', 'greenspace-fill-default', (e) => {
        if (e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
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
                map.setFilter('greenspace-fill-hover', ['==', 'fid', '']);
            }
            if (fid !== undefined && fid !== null) {
                hoveredGreenspaceId = fid;
                map.setFilter('greenspace-fill-hover', ['==', 'fid', hoveredGreenspaceId]);
                map.setPaintProperty('greenspace-fill-hover', 'line-opacity', 1); // Highlight the hovered green space    
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
    map.on('mouseleave', 'greenspace-fill-default', () => {
        // popup.remove();
        map.getCanvas().style.cursor = '';
        map.setFilter('greenspace-fill-hover', ['==', 'fid', '']);
        map.setPaintProperty('greenspace-fill-hover', 'line-opacity', 0);
        
        // Set back visibility of the chart prompt text on mouseleave
        if (chartTextElement) {chartTextElement.style("opacity", 1);}
        // Reset the chart place name
        if (chartPlaceName) {chartPlaceName.text("No green space selected");}

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

    map.on('click', 'greenspace-fill-default', (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0]; // Get the clicked feature
            const bounds = turf.bbox(feature);
            map.fitBounds(bounds, {
                padding: 100,
                duration: 1000,
                // center: feature, // Coordinates of the marker-friendly
                offset: [window.innerWidth / 12, 0]
            });
            
            setTimeout(() => {
                map.setLayoutProperty('greenspace-fill-default', 'visibility', 'none');
                const zoomLevel = map.getZoom();
                map.setMinZoom(zoomLevel);
                if (map.getLayer('isochrone-layer')) {
                    map.setLayoutProperty('isochrone-layer', 'visibility', 'none');
                }
            }, 1000); // Delay matches animation duration
            
            console.log("Zooming to feature:", feature.properties?.name || "Unnamed Feature");
            map.setFilter('greenspace-zoomedline', ['==', 'fid', feature.properties.fid]);
        }
    });

    // 3. 添加车站和线路图层
    // (1) 全部车站（默认灰色）
    map.addLayer({
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
    map.addLayer({
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
    map.addLayer({
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
    map.addLayer({
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
    map.addLayer({
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
            console.log("Closest station:", closestStationName);
            document.getElementById("originStationName").textContent = closestStationName;
        }
    
        // ✅ 新增：设置起点 ID 并尝试绘制路径
        if (closest && closest.properties && closest.properties.id !== undefined) {
            startStationId = closest.properties.id;
            updatePathIfReady();  // ✅ 尝试绘制路线（如果 endStationId 已设置）
        }

        map.flyTo({
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

        const stationFeatures = map.querySourceFeatures('stations', { 
            sourceLayer: '505network_nodes-bv54ia'
        });
    
        if (stationFeatures.length > 0) {
            const randomStation = stationFeatures[Math.floor(Math.random() * stationFeatures.length)];
            
            const randomCoords = randomStation.geometry.coordinates;
            originMarker.setLngLat(randomCoords); // Move the marker to the random station
            originCoords = originMarker.getLngLat();
            map.flyTo({
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

        map.flyTo({
            center: selectedCoords,
            zoom: 9, // Adjust the zoom level as needed
            essential: true, // Ensures the animation is user-friendly
            offset: [window.innerWidth / 8, 0] // Adjust for menus on the left
        });

        findClosestStation(originCoords).then((closest) => {
            closestStationName = getStationIdentifier(closest);
            if (closestStationName) {
                map.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
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
            const greenSpaceFeatures = map.querySourceFeatures('natural_assets', {
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
            const stationFeatures = map.querySourceFeatures('stations', {
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
            map.setFilter('highlighted-station2', ['==', 'name', stationName]);

            console.log("高亮车站:", stationName, "对应绿地:", greenSpaceId);
            
        } catch (error) {
            console.error("高亮车站时出错:", error);
            showAlert("高亮车站时出错");
        }
    }

    // 绿地悬停事件
    map.on('mousemove', 'greenspace-fill-default', async (e) => {
        if (e.features.length > 0) {
            const feature = e.features[0];
            const greenSpaceId = feature.properties?.fid;

            if (greenSpaceId !== undefined && greenSpaceId !== null) {
                await highlightStationOnHover(greenSpaceId);
            }
        }
    });

    // 鼠标离开绿地时清除高亮
    map.on('mouseleave', 'greenspace-fill-default', () => {
        map.setFilter('highlighted-station2', ['==', 'name', '']);
    });

    // 7. 初始化
    const closest = await findClosestStation(originCoords);
    closestStationName = getStationIdentifier(closest);

    if (closestStationName) {
        map.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
    }

    updateDebugInfo();
});
// 初始化时更新一次
const minutes = timeRange.value;
const travelTime = parseInt(minutes) * 60;

const closest = await findClosestStation(originCoords);
closestStationName = getStationIdentifier(closest);

// if (closestStationName) {
//     map.setFilter('origin-station', ['==', ['get', 'name'], closestStationName]);
// }

// updateIsochrone(travelTime, originCoords);
// updateDebugInfo();
// 辅助函数：查找最近车站
async function findClosestStation(coords) {
    const features = map.querySourceFeatures('stations', {
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
            const source = map.getSource('shortest-path');
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
                map.getSource('shortest-path').setData({
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
//




