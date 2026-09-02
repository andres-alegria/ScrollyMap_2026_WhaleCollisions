import React, { useEffect, useMemo, useState } from 'react';
import { geoOrthographic, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import './locator-globe.css';

// Loaded once and shared by every panel that shows a locator.
//
// This reads the same land-110m.json the rest of the story uses, which is
// TopoJSON rather than the GeoJSON the reference repo loads. world-atlas
// topology is ALREADY wound for d3-geo: rewinding it turns the holes into
// giant exteriors and land floods the whole globe. Convert and leave it alone.
let landPromise = null;
const loadLand = () => {
  if (!landPromise) {
    landPromise = fetch('/data/land-110m.json')
      .then((r) => r.json())
      .then((topo) => feature(topo, topo.objects.land))
      .catch((e) => { console.warn('[locator] land failed to load', e); return null; });
  }
  return landPromise;
};

/**
 * Small orthographic locator, bottom-right of a panel. The globe spins so the
 * subject faces the viewer and a red square marks it, the Mongabay convention.
 */
const LocatorGlobe = ({ center, place, size = 80 }) => {   // adjust locator size here
  const [land, setLand] = useState(null);
  useEffect(() => {
    let live = true;
    loadLand().then((d) => { if (live) setLand(d); });
    return () => { live = false; };
  }, []);

  const { landPath, spherePath, markerXY } = useMemo(() => {
    if (!center) return {};
    const r = size / 2 - 2;
    const projection = geoOrthographic()
      .translate([size / 2, size / 2])
      .scale(r)
      .rotate([-center[0], -center[1]])       // spin the subject to face us
      .clipAngle(90);
    const path = geoPath(projection);
    return {
      landPath: land ? path(land) : null,
      spherePath: path({ type: 'Sphere' }),
      markerXY: projection(center),
    };
  }, [land, center, size]);

  if (!center) return null;

  return (
    <div className="locator">
      {place && <span className="locator__place">{place}</span>}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <path d={spherePath} className="locator__ocean" />
        {landPath && <path d={landPath} className="locator__land" />}
        <path d={spherePath} className="locator__rim" />
        {markerXY && (
          <rect className="locator__marker"
                x={markerXY[0] - 3} y={markerXY[1] - 3} width={6} height={6} />
        )}
      </svg>
    </div>
  );
};

export default LocatorGlobe;
