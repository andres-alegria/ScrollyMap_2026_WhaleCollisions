# ScrollyMap_2026_WhaleCollisions

**Collision course**: why whales are dying in the Mediterranean shipping lanes.

A scrollytelling story rendered entirely on a **D3 orthographic globe**. There is
no Mapbox, no access token and no basemap style: every layer is drawn to a single
canvas from GeoJSON in `public/data`.

## Running

```bash
yarn install
yarn start
```

## How it works

`src/config.js` holds the whole story. Each chapter's `globe` block sets the
camera and which data layers are visible:

```js
globe: {
  center: [lon, lat],   // spins so this point faces the viewer
  scale: 2.2,           // 1 = whole sphere, higher zooms in
  graticule: 0,         // 1 by default
  data: {
    mediterranean: 1,   // the basin filled
    medOutline: 1,      // its coastline, stroked
    habitats: 1,
    trafficSlow: 1, trafficMid: 1, trafficFast: 1,
    hotSlow: 0, hotMid: 1, hotFast: 1,
    whaleTracks: 1
  },
  trackProgress: 1,     // draws the 12 whale tracks on
  markers: [{ coords, label, dot: false, labelOffset }]
}
```

Chapters with no `globe` block hide the globe. Motion is scroll-scrubbed rather
than tweened: each chapter's block is a keyframe and the camera is a pure
function of scroll offset, so it tracks the reader exactly.

### Data layers

| Layer | Source | Notes |
|---|---|---|
| `trafficSlow` / `trafficMid` / `trafficFast` | `traffic_by_speed.geojson` | 0.1° grid, three speed bands, 25,155 cells |
| `mediterranean` / `medOutline` | `mediterranean.geojson` | the basin, cut from the same land layer the globe draws |
| `habitats` | `habitats.geojson` | Pelagos, Hellenic Trench, Cetacean Migration Corridor |
| `whaleTracks` | `whale_tracks_PLACEHOLDER.geojson` | **synthetic placeholder data** |

Every data layer is clipped to the Mediterranean polygon, so nothing bleeds into
the Atlantic, the Black Sea or the Red Sea. Anything drawn inside that clip
block inherits it.

### Two traffic palettes

Each speed band has a cool ramp (tints of the ocean color) and a hot one. A
chapter's `hotSlow` / `hotMid` / `hotFast` values say how far to blend between
them, and they interpolate like any other layer value, so the recoloring is
scroll-scrubbed too. The opening traffic chapter runs everything cool; later
chapters bring the two fast bands up to flat `#F6BCB3` and `#530E0D`.

### Performance notes

Two things keep 30,000 cells affordable each frame:

- Cells are drawn with `fillRect` on an inline-projected centroid, not through
  `geoPath`. Feeding them all through the path generator and filling one huge
  accumulated path measured **9 seconds** per frame.
- Each cell's unit vector is precomputed into typed arrays at load, so the frame
  loop contains no trigonometry.

Habitat outlines are Douglas-Peucker simplified at export (18,614 to 340
vertices); the discarded detail is sub-pixel at story zoom.

Polygon rings are wound clockwise, which is what d3-geo wants on a sphere and
the opposite of what RFC 7946 asks for. A counter-clockwise exterior ring is
read as the polygon containing the antipode and floods the whole hemisphere.

### Tuning

`window.__GLOBE__` is exposed for live adjustment:

```js
__GLOBE__.state.scale = 4; __GLOBE__.draw();
```

Colors live in one block at the top of `src/components/globe/globe.js`.

### Building the data

The export scripts live outside this repo, in the project's working folder.
They take a year argument:

```bash
python3 aggregate_vessel_grid.py 2025
python3 export_traffic_by_speed.py 2025
python3 export_web_layers.py 2025
python3 export_mediterranean.py
```
