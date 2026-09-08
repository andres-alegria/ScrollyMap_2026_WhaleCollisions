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
    // A rotated icon's footprint is bigger than the icon: the whale's box is
    // 22 x 20 but arrives at an angle, so it occupies about 30 units of
    // height. Sized down from 31 x 29 / 48 x 14 when the encounter still had
    // to fit the 34-unit gap between the subhead and the date rule. There is
    // more room below the type than there ever was inside it, so these could
    // go back up if the pair reads small.
    size: { whale: { w: 22, h: 20 }, boat: { w: 36, h: 10 } },
    tracks: {
      /* Contact at about (802, 686): below the scroll cue, in the open water
         between the foot of the type and the bottom of the screen.

         It used to sit at y 445, in the 34-unit gap between the subhead and
         the date rule. That band is too narrow to hold two rotated icons
         without them touching the type either side of it, so the encounter is
         out of the type block altogether now.

         WHERE THAT BAND IS, in viewBox units, is not fixed: the plate is
         drawn with preserveAspectRatio slice, so it scales to cover the
         window and the type does not scale with it. For a window W x H, with
         s = max(W/1600, H/900), the centred block lands at

             cue bottom   450 + 153/s      type right edge   800 + 288/s
             screen foot  450 + H/(2s)     title top         450 - 333/s

         - the window's height cancels out of the first two. Across 1024x768
         to 2560x1440 the cue bottom runs 546 to 629 and the screen foot 787
         to 900, so 686 sits in the clear at every one of them. Past about
         21:9 the foot rises far enough to crop the encounter; that is the
         limit of a fixed point, and the type would have to move for it.

         The whale surfaces from below rather than entering from the left,
         which is where it used to come in: at this height the left edge is
         where the social icons are (they sit 115/s above the foot), and the
         only path in that clears them is a flat one.

         The ship holds x >= 1252 all the way down, right of the type's right
         edge at its widest (1138 at 1024x768), and does not turn in until it
         is below the cue. */
      whale:
        'M 300 940 C 340 878, 372 838, 428 800 C 478 766, 528 744, 588 726 C 646 708, 704 700, 744 694 C 762 695, 770 696, 785 690',
      // long straight legs, tight corners - a vessel holding a heading and
      // then altering course, not the whale's continuous meander.
      // The opening leg stays high to clear the landmass along the top of the
      // bathymetry plate, so the diagonal simply runs further.
      boat:
        'M 1700 175 L 1380 175 Q 1342 175, 1324 208 L 1252 588 Q 1244 624, 1210 640 L 900 677 Q 866 680, 820 683'
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
