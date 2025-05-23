from flask import Flask, request, jsonify
from flask_cors import CORS  # ✅ Enable CORS for cross-origin requests
import geopandas as gpd
import networkx as nx
from shapely.geometry import LineString

app = Flask(__name__)
CORS(app)  # ✅ Allow all cross-origin requests

# Load files
nodes_gdf = gpd.read_file("505network_nodes.geojson")
edges_gdf = gpd.read_file("505network_edges.geojson")

# Build the network graph
G = nx.Graph()
for _, row in edges_gdf.iterrows():
    u, v = row['start_id'], row['end_id']
    if G.has_edge(u, v):
        continue  # Skip duplicate edges
    G.add_edge(u, v, geometry=row['geometry'], weight=row['geometry'].length)

@app.route("/shortest-path")
def shortest_path():
    """
    Calculate the shortest path between two nodes and return as a GeoJSON Feature.
    Query parameters:
      - start_id: Node ID to start from
      - end_id: Node ID to end at
    Returns:
      - GeoJSON Feature of the merged path line, or error message on failure
    """
    try:
        start_id = int(request.args.get("start_id"))
        end_id = int(request.args.get("end_id"))

        # Find the shortest path using edge length as weight
        path = nx.shortest_path(G, source=start_id, target=end_id, weight='weight')

        lines = []
        for u, v in zip(path[:-1], path[1:]):
            edge = edges_gdf[((edges_gdf['start_id'] == u) & (edges_gdf['end_id'] == v)) |
                             ((edges_gdf['start_id'] == v) & (edges_gdf['end_id'] == u))].iloc[0]
            lines.append(edge.geometry)

        all_coords = []
        seen = set()

        for line in lines:
            for pt in line.coords:
                if pt not in seen:
                    all_coords.append(pt)
                    seen.add(pt)

        merged_line = LineString(all_coords)

        return jsonify({
            "type": "Feature",
            "geometry": merged_line.__geo_interface__,
            "properties": {}
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)

