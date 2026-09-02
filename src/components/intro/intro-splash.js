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
    // ---- adjust icon sizes here (viewBox units) ----
    // The encounter has to fit a 34-unit band, and a rotated icon's footprint
    // is bigger than the icon: the whale's box is 25 x 23 but arrives at an
    // angle, so it occupies about 33 units of height. These were sized down
    // from 31 x 29 / 48 x 14 when the subhead lost a line and the gaps in the
    // type closed up.
    size: { whale: { w: 22, h: 20 }, boat: { w: 36, h: 10 } },
    tracks: {
      // Contact at about (804, 445), centered, in the clear band between the
      // subhead (bottom 428) and the date rule (top 462).
      //
      // It used to sit between the title and the subhead. That gap was 36
      // units when the subhead ran to two lines; at one line the whole block
      // shifts down and the title's second line now ends at 373, so the old
      // contact point at y 364 landed on the word "course". The band below
      // the subhead is the only clear one left that is wide enough.
      //
      // The whale enters low on the left, above the social icons (y 654-713),
      // and climbs to the band well left of the subhead's left edge (x 560).
      // The final approach is shallow, about -12 and 177 degrees, so neither
      // icon tilts far enough to grow out of the band. The boat's descent is
      // steeper than it looks it needs to be: it has to be below y 428 by the
      // time it reaches x 1040, or it clips the end of the subhead line.
      whale:
        'M 100 620 C 230 590, 320 545, 372 500 C 412 462, 448 448, 500 444 C 584 434, 668 432, 722 436 C 748 438, 762 450, 785 445',
      // long straight legs, tight corners - a vessel holding a heading and
      // then altering course, not the whale's continuous meander.
      // The opening leg stays at y=150 to clear the landmass along the top of
      // the bathymetry plate, so the diagonal simply runs further.
      boat:
        'M 1690 150 L 1350 150 Q 1312 150, 1294 182 L 1150 396 Q 1132 424, 1096 430 L 894 437 Q 860 440, 818 438'
    }
  },
  portrait: {
    viewBox: '0 0 620 1342',
    // Smaller than landscape in absolute terms so both icons plus a readable
    // gap fit in the band below the scroll cue without touching the bottom.
    size: { whale: { w: 52, h: 49 }, boat: { w: 68, h: 19 } },
    tracks: {
      // They meet head-on at an angle rather than dead vertical, which also
      // carries the ship's final leg clear of the scroll cue's mouse glyph
      // (viewBox x 296-324, y 678-757) instead of running through it - the
      // diagonal sits around x 395-455 crossing that band.
      //
      // Contact point is (310, 907), just below the cue block. It sat 35 units
      // higher until the phone headline went to 56px: the taller title pushes
      // the whole centred block down, and the ship's nose ended up flush
      // against the bottom of "Scroll down, but not too fast".
      //
      // Icons are centered on their path endpoints, so each endpoint is set
      // back along its own heading by half the icon's length:
      //   ship  heading 126 deg, 68 long -> endpoint (330, 880)
      //   whale heading -54 deg, 52 long -> endpoint (288, 938), set back a
      //     further ~12 units so the silhouettes meet nose to nose rather
      //     than the hull overlapping the whale's body
      whale:
        'M 110 1400 C 176 1330, 206 1270, 212 1185 C 219 1093, 236 1025, 262 989 C 272 975, 274 957, 288 938',
      boat:
        'M 470 -40 L 470 300 Q 470 336, 496 358 L 540 396 Q 562 416, 556 448 L 534 570 Q 528 606, 508 630 L 330 880'
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

const IntroSplash = () => {
  const wrapRef = useRef(null);
  const [variant, setVariant] = useState(pickVariant);

  useEffect(() => {
    const onResize = () => setVariant(pickVariant());
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

        {/* Above the artwork, below the headline - the layer order used in
            the Illustrator file. */}
        <rect className="intro-grain" x="0" y="0" width={vbW} height={vbH}
              filter="url(#intro-grain)" />
      </svg>
    </div>
  );
};

export default IntroSplash;
