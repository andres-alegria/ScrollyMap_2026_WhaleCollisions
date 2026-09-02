import {
  geoOrthographic, geoPath, geoGraticule10, geoDistance, geoInterpolate
} from 'd3-geo';
import { feature } from 'topojson-client';

/* ------------------------------------------------------------------
   Geometry helpers for the orthographic globe.

   The expensive part is the traffic grid: ~9,400 cells, each a tiny
   quad. Drawing them one path at a time is far too slow, so cells are
   bucketed by color once at load and drawn as a handful of batched
   paths per frame, with everything on the far side of the sphere
   culled before it reaches the path generator.
   ------------------------------------------------------------------ */

// d3's orthographic projection rotates by negating the point you want facing you
export const rotationFor = ([lon, lat]) => [-lon, -lat, 0];

export const shortestDelta = (from, to) => {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
};

export const makeProjection = (width, height, scaleFactor = 1) => {
  const base = Math.min(width, height) / 2.2;
  return geoOrthographic()
    .scale(base * scaleFactor)
    .translate([width / 2, height / 2])
    .clipAngle(90);
};

export const isVisible = (projection, coords) => {
  const r = projection.rotate();
  return geoDistance(coords, [-r[0], -r[1]]) < Math.PI / 2;
};

// Great-circle arc as a LineString so geoPath clips it against the sphere
export const arcFeature = (from, to, progress = 1, steps = 48) => {
  const interp = geoInterpolate(from, to);
  const n = Math.max(2, Math.round(steps * progress));
  const coordinates = [];
  for (let i = 0; i < n; i++) coordinates.push(interp(i / (steps - 1)));
  return { type: 'LineString', coordinates };
};

// Progressive reveal for a track: slice its coordinates by progress
export const partialLine = (coords, progress) => {
  if (progress >= 1) return { type: 'LineString', coordinates: coords };
  const n = Math.max(2, Math.round(coords.length * progress));
  return { type: 'LineString', coordinates: coords.slice(0, n) };
};

/**
 * Reveal a track against a CLOCK rather than against its own length.
 *
 * The twelve tracks barely overlap in time: they run one after another from
 * April 2021 to August 2024. Slicing each by the same fraction would march all
 * twelve forward together and make a date readout meaningless, so each is cut
 * at the last vertex whose own timestamp has been reached. A whale that has
 * not been tagged yet returns null and is skipped; one whose tag has already
 * stopped stays fully drawn.
 */
export const partialLineByTime = (coords, times, clock) => {
  if (!times || times.length < 2) return { type: 'LineString', coordinates: coords };
  if (clock >= times[times.length - 1]) return { type: 'LineString', coordinates: coords };
  if (clock < times[1]) return null;
  let lo = 0;
  let hi = times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (times[mid] <= clock) lo = mid; else hi = mid - 1;
  }
  return lo < 1 ? null : { type: 'LineString', coordinates: coords.slice(0, lo + 1) };
};

// Earliest and latest timestamp across every track: the span the clock runs.
export const trackSpan = (fc) => {
  let t0 = Infinity;
  let t1 = -Infinity;
  (fc.features || []).forEach((f) => {
    const t = f.properties && f.properties.coordinateProperties
      && f.properties.coordinateProperties.times;
    if (!t || !t.length) return;
    if (t[0] < t0) t0 = t[0];
    if (t[t.length - 1] > t1) t1 = t[t.length - 1];
  });
  return Number.isFinite(t0) ? { t0, t1 } : null;
};

const centroidOf = (geometry) => {
  const ring = geometry.type === 'Polygon'
    ? geometry.coordinates[0]
    : geometry.coordinates[0][0];
  let x = 0, y = 0;
  const n = Math.min(ring.length, 4);
  for (let i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
  return [x / n, y / n];
};

// --- color helpers -------------------------------------------------
// Traffic colors are resolved per frame rather than baked into the buckets,
// because a chapter can sit part-way between the muted basin palette and the
// red speed palette and needs the blend of the two.
export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

export const mixRgb = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t)
];

export const rgbCss = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/**
 * Pre-bucket a traffic FeatureCollection for fast drawing.
 *
 * Orthographic projection is just a rotation of a point's unit vector, so each
 * cell's vector is computed once here and stored in typed arrays. The render
 * loop then needs no trigonometry at all - only multiplies and adds - which is
 * what makes ~14,000 cells affordable every frame.
 *
 * Returns, per speed-class key, an array of buckets:
 *   { t, n, ax, by, cz }   // t = 0..1 position in the class's ramp
 *
 * `t` is stored instead of a color so the same buckets can be painted in
 * either palette, or in a blend of the two, without re-bucketing.
 */
export const bucketTraffic = (fc, classes, buckets = 6) => {
  const RAD = Math.PI / 180;
  const out = {};

  classes.forEach(({ key, max }) => {
    const bins = Array.from({ length: buckets }, (_, i) => ({
      t: buckets === 1 ? 0 : i / (buckets - 1),
      pts: []
    }));

    fc.features.forEach((f) => {
      const v = f.properties[key];
      if (v === undefined) return;
      // sqrt keeps the long tail from collapsing into one bucket
      const t = Math.min(1, Math.sqrt(v / max));
      const idx = Math.min(buckets - 1, Math.floor(t * buckets));
      const [lon, lat] = centroidOf(f.geometry);
      const la = lat * RAD;
      const lo = lon * RAD;
      const cosLat = Math.cos(la);
      bins[idx].pts.push([cosLat * Math.cos(lo), cosLat * Math.sin(lo), Math.sin(la)]);
    });

    out[key] = bins
      .filter((b) => b.pts.length)
      .map((b) => {
        const n = b.pts.length;
        const ax = new Float64Array(n);
        const by = new Float64Array(n);
        const cz = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          ax[i] = b.pts[i][0]; by[i] = b.pts[i][1]; cz[i] = b.pts[i][2];
        }
        return { t: b.t, n, ax, by, cz };
      });
  });

  return out;
};

export const loadWorld = async () => {
  const [landRes, countryRes] = await Promise.all([
    fetch('/data/land-110m.json'),
    fetch('/data/countries-110m.json')
  ]);
  const landTopo = await landRes.json();
  const countryTopo = await countryRes.json();
  return {
    land: feature(landTopo, landTopo.objects.land),
    countries: feature(countryTopo, countryTopo.objects.countries)
  };
};

export const loadStoryData = async () => {
  const get = (u) => fetch(u).then((r) => r.json());
  const [traffic, habitats, tracks, mediterranean] = await Promise.all([
    get('/data/traffic_by_speed.geojson'),
    get('/data/habitats.geojson'),
    get('/data/whale_tracks_PLACEHOLDER.geojson'),
    // the basin cut out of the global ocean polygon - see
    // Scripts/export_mediterranean.py in the project folder
    get('/data/mediterranean.geojson')
  ]);
  return { traffic, habitats, tracks, mediterranean };
};

export { geoPath, geoGraticule10 };
