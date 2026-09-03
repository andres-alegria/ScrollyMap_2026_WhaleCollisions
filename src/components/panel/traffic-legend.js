import React from 'react';
import './traffic-legend.css';

/**
 * The three speed bands, keyed as the tileset carries them on every cell.
 *
 * The colors are not here: they come off the map, so the legend cannot end up
 * disagreeing with the layer it describes after a restyle in Studio. Only the
 * thresholds live in the code, because those are what the data was cut on and
 * they do not change without the data changing.
 */
const BANDS = [
  { key: 'slow', label: '10 to 15 knots' },
  { key: 'mid', label: '15 to 25 knots' },
  { key: 'fast', label: 'Above 25 knots' },
];

const TrafficLegend = ({ colors, opacity = 0 }) => {
  if (!colors) return null;
  return (
    <div
      className="traffic-legend"
      style={{ opacity }}
      // invisible for most of the story; it must not be read out or tabbed to
      aria-hidden={opacity < 0.5}
    >
      <p className="traffic-legend__title">Vessel speed</p>
      <ul className="traffic-legend__list">
        {BANDS.map(({ key, label }) => (
          colors[key] ? (
            <li className="traffic-legend__row" key={key}>
              <span
                className="traffic-legend__dot"
                style={{ backgroundColor: colors[key] }}
              />
              {label}
            </li>
          ) : null
        ))}
      </ul>
    </div>
  );
};

export default TrafficLegend;
