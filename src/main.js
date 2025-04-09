import './style.css'

mapboxgl.accessToken = 'pk.eyJ1IjoicGFuZXZhIiwiYSI6ImNtNXk0NXdiOTBhM3AyanIyNHR1OXBsejEifQ.gELzGrqRoZiEhabFwjVkiw'; // Put your Mapbox Public Access token here

// Load a new map in the 'map' HTML div
const map = new mapboxgl.Map({
  container: 'map', // container id
  style: 'mapbox://styles/paneva/cm8g3esp700lp01qsdl13anxg', // map style
  center: [0, 51.5], // starting position [lng, lat]
  zoom: 8 // starting zoom
  // pitch: 50 // optional tilt
});

// Wait for the map to load before doing stuff
// map.on('load', function() {
//   // Set global light properties which influence 3D layer shadows
//   // map.setLight({ color: "#fff", intensity: 0.25, position: [1.15, 210, 30] });

//   // Add standard navigation control (zoom, rotate)
//   map.addControl(new mapboxgl.NavigationControl());
// });