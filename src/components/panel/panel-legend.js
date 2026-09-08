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
 * `items` are { mark, color, label, size }, where mark is 'dot' for the layers
 * drawn as circles, 'line' for the ones drawn as lines, and 'box' for an area,
 * which is drawn the way an area is on the map: a faint wash inside a solid
 * outline, both in the layer's own colour. `size` is optional
 * and only applies to a dot: it sets that swatch's diameter in pixels, for a
 * band the map itself draws smaller.
 *
 * `foot` is an optional line under the rows, for saying what the marks are
 * counting - a key that names three speed bands without saying what a mark
 * stands for leaves the reader to guess.
 */
// An area swatch needs the fill and the outline to be the same hue at
// different strengths, and the colour arrives as a hex string.
const withAlpha = (hex, a) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

const Legend = ({ title, items, foot, opacity = 0 }) => {
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
        {items.map(({ mark, color, label, size }) => (
          <li className="panel-legend__row" key={label}>
            <span
              className={`panel-legend__mark panel-legend__mark--${mark}`}
              style={mark === 'box'
                ? { backgroundColor: withAlpha(color, 0.3), borderColor: color }
                : (size
                  ? { backgroundColor: color, '--dot': `${size}px` }
                  : { backgroundColor: color })}
            />
            {label}
          </li>
        ))}
      </ul>
      {foot && <p className="panel-legend__foot">{foot}</p>}
    </div>
  );
};

export default Legend;
