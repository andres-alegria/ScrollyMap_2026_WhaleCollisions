import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
// Inlined by CRA's SVGR loader, so the shapes are real DOM nodes that can be
// transformed and recolored - an <image> pointing at an SVG without intrinsic
// width/height renders nothing in Chrome.
import { ReactComponent as Whale } from '../../assets/whale.svg';
import { ReactComponent as Boat } from '../../assets/boat.svg';
import './intro.scss';

/* ------------------------------------------------------------------
   Intro splash: a whale and a ship travel in, each leaving its track
   behind, and stop just short of meeting.

   Tracks are drawn with the stroke-dash technique (dasharray set to the
   path length, dashoffset animated to zero) and the icons are placed with
   getPointAtLength, so icon and track stay locked together however the
   easing is tuned.

   Two art directions: a wide landscape frame where the routes come in from
   the upper sides, and a portrait frame where the whale rises from the
   bottom and the ship descends from the top. One composition cannot serve
   both a 2:1 and a 0.46:1 frame - on a phone the landscape routes are
   almost entirely cropped away.
   ------------------------------------------------------------------ */

// The artwork's own heading, in degrees, measured from its silhouette:
// the ship is drawn bow-right (0), the whale on a diagonal with its head up
// and to the right. Subtract these so the head always leads.
const BASE_HEADING = { whale: -47, boat: 0 };

/* Route character
   ---------------
   whale: sinuous, reversing curvature, tight radii - an animal meandering.
   ship:  long straight legs joined by rounded course changes at waypoints,
          the way a vessel actually steers. Distinct from the whale without
          being the blocky right angles of a diagram.
*/
const VARIANTS = {
  landscape: {
    viewBox: '0 0 1600 900',
    // the height the two paths were drawn to meet at; shiftFor moves the
    // artwork by the difference between this and where the X icon is
    contact: 770,
    // ---- adjust icon sizes here (viewBox units) ----
    // A rotated icon's footprint is bigger than the icon: the whale's box is
    // 22 x 20 but arrives at an angle, so it occupies about 30 units of
    // height. Sized down from 31 x 29 / 48 x 14 when the encounter still had
    // to fit the 34-unit gap between the subhead and the date rule. There is
    // more room below the type than there ever was inside it, so these could
    // go back up if the pair reads small.
    size: { whale: { w: 22, h: 20 }, boat: { w: 36, h: 10 } },
    tracks: {
      /* Contact at about (802, 770): below the scroll cue, level with the X
         in the social icons on a laptop-height window.

         It used to sit at y 445, in the gap between the subhead and the date
         rule. That band is too narrow to hold two rotated icons without them
         touching the type either side of it, so the encounter is out of the
         type block altogether now.

         WHERE THE TYPE IS, in viewBox units, is not fixed: the plate is drawn
         with preserveAspectRatio slice, so it scales to cover the window and
         the type does not scale with it. The block is centred, so for a
         window W x H with s = max(W/1600, H/900) every edge of it is
         450 + (its offset from the middle of the screen)/s, and the window's
         height cancels out:

             title top   450 - 243/s        type sides   800 +/- 288/s
             subhead     450 +  37/s .. 450 + 64/s
             cue foot    450 + 243/s        screen foot  450 + H/(2s)

         The social icons are the exception: they hang off the foot of the
         screen rather than the middle, so their height moves with the window
         where everything else above does not. The X sits 115 to 99 above the
         foot, which is 765-784 on a 768-tall window, 785-801 at 900 and
         804-818 at 1080.

         The screen's foot is 900 for any window at 16:9 or squarer, because
         there s is set by the height. Wider than that it comes up: 850 at
         2:1, 788 at 21:9. The cue's foot runs the other way - 735 at
         1366x768, 693 at 1440x900, 652 at 1920x1080 - so the clear band
         between the two closes from both ends, and 770 is inside it at every
         window from 1024x768 to 3440x1440. It also lands on the X on the
         short windows, where the icons ride highest; on a tall one they sink
         with the bottom edge and the encounter stays where it is, above
         them. Nothing fixed in the plate can follow them down.

         The whale comes in at the left edge level with the subhead (473 to
         525 across that range) and works down and across, holding x <= 393
         until it is past the cue's foot, which keeps it outside the type's
         left edge - 462 at its widest - all the way down. The last stretch
         is nearly flat because of it: on a 768-tall window there are only 35
         units between the cue's foot and the encounter to cross 300 in. That also keeps it
         well above the social icons in the corner it used to pass through.

         The ship holds x >= 1256 on the way down, right of the type's right
         edge at its widest (1138), and does not turn in until it is below
         the cue. */
      whale:
        'M -30 496 C 96 516, 178 546, 240 588 C 300 630, 342 674, 372 716 C 400 754, 466 772, 560 774 C 646 776, 706 772, 748 772 C 764 772, 768 774, 785 770',
      // long straight legs, tight corners - a vessel holding a heading and
      // then altering course, not the whale's continuous meander.
      // The opening leg stays high to clear the landmass along the top of the
      // bathymetry plate, so the diagonal simply runs further.
      boat:
        'M 1700 175 L 1380 175 Q 1342 175, 1324 208 L 1256 680 Q 1248 718, 1214 734 L 900 761 Q 866 764, 820 767'
    }
  },
  portrait: {
    viewBox: '0 0 620 1342',
    contact: 985,          // not shifted; here so the two variants read alike
    // Smaller than landscape in absolute terms so both icons plus a readable
    // gap fit in the band below the scroll cue without touching the bottom.
    size: { whale: { w: 52, h: 49 }, boat: { w: 68, h: 19 } },
    tracks: {
      // They meet head-on at an angle rather than dead vertical, which also
      // carries the ship's final leg clear of the scroll cue's mouse glyph
      // (viewBox x 296-324, y 678-757) instead of running through it - the
      // diagonal sits around x 395-455 crossing that band.
      //
      // Contact point is (310, 985), clear below the cue block. It was at 907
      // and the ship's hull was still crossing the last few units of "Scroll
      // down, but not too fast" - measured at 402x874, the icon's top was 5px
      // above the foot of that block. The whole encounter moved down 78 units;
      // the curves are otherwise the ones that were tuned before.
      //
      // The cue block's foot lands at 671 + 120/s in viewBox units, where
      // s = max(W/620, H/1342), and the foot of the screen at 671 + H/(2s).
      // Across phones and portrait tablets that puts the block's foot between
      // 767 and 872 and the screen's between 1084 and 1342, so the pair sits
      // in the clear at either end.
      //
      // The ship's track still crosses the type on the way down. In portrait
      // it has to: the headline and subhead run the full width of a phone,
      // so unlike the landscape frame there is no clear corridor down either
      // side. It is routed to miss the mouse glyph (x 296-324, y 706-760),
      // which is the one piece of the cue with ink all the way through.
      //
      // Icons are centered on their path endpoints, so each endpoint is set
      // back along its own heading by half the icon's length:
      //   ship  heading 126 deg, 68 long -> endpoint (330, 958)
      //   whale heading -54 deg, 52 long -> endpoint (288, 1016), set back a
      //     further ~12 units so the silhouettes meet nose to nose rather
      //     than the hull overlapping the whale's body
      whale:
        'M 110 1478 C 176 1408, 206 1348, 212 1263 C 219 1171, 236 1103, 262 1067 C 272 1053, 274 1035, 288 1016',
      // The opening leg is longer rather than shifted, so the ship still
      // starts above the top edge and steams in.
      boat:
        'M 470 -40 L 470 378 Q 470 414, 496 436 L 540 474 Q 562 494, 556 526 L 534 648 Q 528 684, 508 708 L 330 958'
    }
  }
};

// Portrait art direction below this width-to-height ratio; catches phones and
// tablets held upright.
// Files in /public are served as-is; PUBLIC_URL keeps them correct if the
// site is ever deployed under a sub-path.
const PUB = process.env.PUBLIC_URL || '';

const pickVariant = () =>
  (typeof window !== 'undefined' && window.innerWidth / window.innerHeight < 0.85)
    ? 'portrait'
    : 'landscape';

/* How far the artwork has to move for the encounter to meet the social icons.
   ------------------------------------------------------------------------
   Everything else in the intro is centred, so its height in viewBox units is
   the same whatever the window does - the plate scales to cover the window
   and the block's offsets from the middle divide by that scale, and the
   window's height cancels out. The social icons are the exception: they hang
   off the FOOT of the screen, so their height moves with the window, and no
   fixed point in the plate can sit at it. At 1366x768 the X is at 765-784 in
   viewBox units; at 1920x1080 it is at 804-818.

   So the pair is nudged as a whole by the difference between the height the
   paths were drawn to meet at and where the X actually is. The nudge is small
   - about +5 at 768, +23 at 900, +41 at 1080 - and it moves the whole route
   with it, which is why the tracks are drawn to arrive shallow: a few tens of
   units up or down does not change where they run.

   Landscape only. Portrait is left exactly where it was tuned. */
const X_ABOVE_FOOT = 107;      // the X icon's centre, in px above the screen's foot
const CUE_BELOW_MID = 243;     // the scroll cue's foot, in px below the middle
const ICON_HALF = 15;          // half the encounter's height, in viewBox units

const shiftFor = (variant, V) => {
  if (variant !== 'landscape' || typeof window === 'undefined') return 0;
  const [vbW, vbH] = V.viewBox.split(' ').slice(2).map(Number);
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (!W || !H) return 0;
  const s = Math.max(W / vbW, H / vbH);
  const mid = vbH / 2;
  const foot = mid + H / (2 * s);
  const want = foot - X_ABOVE_FOOT / s;
  // Never far enough up to touch the foot of the scroll cue, nor far enough
  // down to put the pair under the bottom edge. On a window short enough to
  // drop the headline to 40px the cue sits higher than this, so the first
  // bound is conservative rather than wrong.
  const highest = mid + CUE_BELOW_MID / s + ICON_HALF + 8;
  const lowest = foot - ICON_HALF - 4;
  const at = Math.max(Math.min(want, lowest), highest);
  return Math.round(at - V.contact);
};

const IntroSplash = () => {
  const wrapRef = useRef(null);
  const [variant, setVariant] = useState(pickVariant);
  // How far the route has to move so the encounter lands on the social icons,
  // which are the one thing here anchored to the foot of the screen. Follows
  // the window, not just the art direction, so it is its own state.
  const [shift, setShift] = useState(() => {
    const v = pickVariant();
    return shiftFor(v, VARIANTS[v]);
  });

  useEffect(() => {
    const onResize = () => {
      const v = pickVariant();
      setVariant(v);
      setShift(shiftFor(v, VARIANTS[v]));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const V = VARIANTS[variant];
  const [vbW, vbH] = V.viewBox.split(' ').slice(2).map(Number);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return undefined;

    const items = ['whale', 'boat'].map((key) => {
      const path = root.querySelector(`#track-${key}`);
      const icon = root.querySelector(`#icon-${key}`);
      if (!path || !icon) return null;
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      return { key, path, icon, len };
    }).filter(Boolean);

    if (!items.length) return undefined;

    const place = (it, p) => {
      const at = it.len * p;
      const pt = it.path.getPointAtLength(at);
      // tangent from a short step along the path, so rotation follows the route
      const ahead = it.path.getPointAtLength(Math.min(it.len, at + 1.5));
      const behind = it.path.getPointAtLength(Math.max(0, at - 1.5));
      const deg = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI;
      const { w, h } = V.size[it.key];
      it.icon.setAttribute(
        'transform',
        `translate(${pt.x} ${pt.y}) rotate(${deg - BASE_HEADING[it.key]}) translate(${-w / 2} ${-h / 2})`
      );
      it.path.style.strokeDashoffset = String(it.len * (1 - p));
    };

    items.forEach((it) => place(it, 0));

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((it) => place(it, 1));
      return undefined;
    }

    const state = { whale: 0, boat: 0 };
    const tl = gsap.timeline({ delay: 0.35 });
    // ---- adjust travel timing here ----
    tl.to(state, {
      whale: 1, duration: 3.4, ease: 'power1.inOut',
      onUpdate: () => place(items.find((i) => i.key === 'whale'), state.whale)
    }, 0);
    tl.to(state, {
      boat: 1, duration: 3.0, ease: 'power1.inOut',
      onUpdate: () => place(items.find((i) => i.key === 'boat'), state.boat)
    }, 0.5);

    // Exposed for tuning, alongside window.__GLOBE__:
    //   __INTRO__.tl.progress(1)      jump to the end
    //   __INTRO__.place('whale', 0.5)
    if (typeof window !== 'undefined') {
      window.__INTRO__ = {
        tl, items, variant,
        place: (key, p) => place(items.find((i) => i.key === key), p)
      };
    }

    return () => {
      tl.kill();
      if (typeof window !== 'undefined') delete window.__INTRO__;
    };
    // rebuilt whenever the art direction changes
  }, [variant, V]);

  return (
    <div className="intro-splash" ref={wrapRef} aria-hidden="true">
      {/* Bathymetry plate under everything. The grain lives inside the SVG
          above, so it still sits on top of this. */}
      <div
        className="intro-splash__bg"
        style={{ backgroundImage: `url(${PUB}/assets/intro-bg.jpg)` }}
      />

      <svg
        className="intro-splash__svg"
        viewBox={V.viewBox}
        preserveAspectRatio="xMidYMid slice"
        key={variant}
      >
        <defs>
          {/* Grain generated in the SVG itself. A tiled background image bands
              on its tile seams no matter how isotropic the noise is; one
              filtered rect covering the whole viewBox cannot. */}
          <filter id="intro-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85"
                          numOctaves="2" stitchTiles="stitch" result="noise" />
            <feColorMatrix in="noise" type="saturate" values="0" />
          </filter>
        </defs>

        {/* Routes and icons together, so the nudge that lands the encounter
            on the social icons cannot separate an icon from its track. The
            grain below stays put: it covers the whole plate. The icons keep
            setting their own transform inside this one, and getPointAtLength
            reads the path in its own units, so neither is affected. */}
        <g transform={`translate(0 ${shift})`}>
          <path id="track-whale" className="intro-track intro-track--whale" d={V.tracks.whale} />
          <path id="track-boat" className="intro-track intro-track--boat" d={V.tracks.boat} />

          <g id="icon-whale" className="intro-icon">
            <Whale width={V.size.whale.w} height={V.size.whale.h}
                   preserveAspectRatio="xMidYMid meet" />
          </g>
          <g id="icon-boat" className="intro-icon">
            <Boat width={V.size.boat.w} height={V.size.boat.h}
                  preserveAspectRatio="xMidYMid meet" />
          </g>
        </g>

        {/* Above the artwork, below the headline - the layer order used in
            the Illustrator file. */}
        <rect className="intro-grain" x="0" y="0" width={vbW} height={vbH}
              filter="url(#intro-grain)" />
      </svg>
    </div>
  );
};

export default IntroSplash;
