import React from 'react';
import './panel-legend.css';

/**
 * A key at the foot of the text column.
 *
 * The story runs more than one: the speed bands hold from the chapter that
 * introduces them through the habitat chapters, and the whale chapter replaces
 * them with its own. They are stacked in a single grid cell rather than
 * swapped, so one can fade out while the other fades in without the column
 * changing height under the paragraph.
 *
 * No colors live here. They are passed in - the speed swatches read off the
 * Mapbox style, the track color from the module that draws the tracks - so a
 * key can never end up describing something the map is not doing.
 *
 * `items` are { mark, color, label }, where mark is 'dot' for the layers drawn
 * as circles and 'line' for the ones drawn as lines.
 */
const Legend = ({ title, items, opacity = 0 }) => {
  if (!items || !items.length) return null;
  return (
    <div
      className="panel-legend"
      style={{ opacity }}
      // invisible for most of the story; it must not be read out or tabbed to
      aria-hidden={opacity < 0.5}
    >
      {title && <p className="panel-legend__title">{title}</p>}
      <ul className="panel-legend__list">
        {items.map(({ mark, color, label }) => (
          <li className="panel-legend__row" key={label}>
            <span
              className={`panel-legend__mark panel-legend__mark--${mark}`}
              style={{ backgroundColor: color }}
            />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Legend;
