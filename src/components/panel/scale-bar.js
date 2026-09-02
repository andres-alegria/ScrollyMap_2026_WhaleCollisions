import React from 'react';
import './scale-bar.css';

/**
 * Dual scale bar: the same round number in km and in miles, so the two lines
 * differ in length by a factor of 1.609.
 *
 * Lengths arrive as fractions of the panel's width, worked out per panel from
 * the ground distance the image covers, which keeps the bar correct whatever
 * size the panel is rendered at. Ported from the isolated-peoples scrolly.
 */
const ScaleBar = ({ n, kmFrac, miFrac }) => {
  if (!n) return null;
  return (
    <div className="scalebar" aria-label={`Scale: ${n} kilometres and ${n} miles`}>
      <div className="scalebar__row">
        <span className="scalebar__label">{n} km</span>
        <span className="scalebar__line" style={{ width: `${kmFrac * 100}%` }} />
      </div>
      <div className="scalebar__row">
        <span className="scalebar__label">{n} mi</span>
        <span className="scalebar__line" style={{ width: `${miFrac * 100}%` }} />
      </div>
    </div>
  );
};

export default ScaleBar;
