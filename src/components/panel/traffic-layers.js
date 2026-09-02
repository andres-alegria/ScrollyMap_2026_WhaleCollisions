/**
 * The vessel-traffic layers, shared by both maps in the piece.
 *
 * One vector tileset carries all three speed bands as attributes on a single
 * layer, so the three style layers below are filters on the same source
 * rather than three sources:
 *
 *   s   10-15 knots, every cell with any traffic at all
 *   m   15-25 knots, above 100 vessel-hours
 *   f   above 25 knots, above 20 vessel-hours
 *
 * Because it is vector, the colour is a style property rather than something
 * baked into an image, which is what lets a chapter blend the fast bands from
 * the basin's own tints up to the reds. The raster route would have fixed
 * those colours at export.
 */

export const TRAFFIC_SOURCE = 'whale-traffic';
export const TRAFFIC_TILESET = 'mapbox://mongabay.whale_traffic_2025';
const SOURCE_LAYER = 'traffic';

// Two palettes per band. `cool` is a tint of the sea, for showing traffic
// without emphasising it; `hot` is the Mongabay red family, for the chapters
// about speed. adjust traffic colours here
const BANDS = [
  { id: 'traffic-slow', key: 's', cool: '#2C7583', hot: '#2C7583' },
  { id: 'traffic-mid',  key: 'm', cool: '#3C919F', hot: '#F6BCB3' },
  { id: 'traffic-fast', key: 'f', cool: '#59AFBF', hot: '#530E0D' },
];

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (u, v) => Math.round(u + (v - u) * t);
  return `rgb(${c(r1, r2)},${c(g1, g2)},${c(b1, b2)})`;
};
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * Add the source and the three layers. Safe to call more than once.
 *
 * `beneath` is the id of a style layer to insert below, so the basemap's own
 * labels stay on top of the data rather than being buried by it.
 */
export const addTrafficLayers = (map, beneath) => {
  if (!map || !map.getStyle()) return;
  if (!map.getSource(TRAFFIC_SOURCE)) {
    map.addSource(TRAFFIC_SOURCE, { type: 'vector', url: TRAFFIC_TILESET });
  }
  // put the data under the first symbol layer, which is where the place names
  // start in this style
  const firstSymbol = beneath || (map.getStyle().layers.find((l) => l.type === 'symbol') || {}).id;

  BANDS.forEach(({ id, key, cool }) => {
    if (map.getLayer(id)) return;
    map.addLayer({
      id,
      type: 'fill',
      source: TRAFFIC_SOURCE,
      'source-layer': SOURCE_LAYER,
      filter: ['has', key],
      paint: {
        'fill-color': cool,
        'fill-opacity': 0,          // chapters raise this; nothing shows by default
        'fill-antialias': false,    // cells butt against each other; seams otherwise
      },
    }, firstSymbol);
  });
};

/**
 * Set what the reader sees. `hot` blends each band's colour from its cool tint
 * to its red, and the three opacities say how present each band is.
 */
export const setTraffic = (map, { slow = 0, mid = 0, fast = 0, hot = 0 } = {}) => {
  if (!map || !map.getLayer('traffic-slow')) return;
  const o = { s: slow, m: mid, f: fast };
  const h = clamp01(hot);
  BANDS.forEach(({ id, key, cool, hot: hotColor }) => {
    map.setPaintProperty(id, 'fill-opacity', clamp01(o[key]));
    map.setPaintProperty(id, 'fill-color', mix(cool, hotColor, h));
  });
};
