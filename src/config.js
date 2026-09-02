/* ------------------------------------------------------------------
   Story configuration.

   This scrolly renders entirely on a D3 orthographic globe (see
   src/components/globe/). There is no Mapbox map, no access token and
   no basemap style - every layer is drawn from GeoJSON in /public/data.

   Each chapter's `globe` block controls the camera, which data layers
   are visible, and any markers or arcs. Chapters with no `globe` block
   hide the globe entirely.
   ------------------------------------------------------------------ */

// adjust legend swatch colors here - these mirror the ramps in globe.js
const C = {
  // cool: tints of the sea color, used where traffic is shown but not
  // emphasized. One band per speed class. These mirror the ramps in globe.js.
  slowCool: '#2C7583',
  midCool: '#3C919F',
  fastCool: '#59AFBF',
  // Orange family, brand: the whale habitats, as on the printed map
  habitat: '#E8A643',
  // hot: two flat tones, one per fast band. Deliberately not a ramp - the
  // reader is being asked to tell two speed classes apart, not to judge how
  // many hours are in a cell.
  mid: '#F6BCB3',
  fast: '#530E0D',
  track: '#BFECB1'
};

// The bands are 10-15 / 15-25 / >25 knots. There is no data below 10 knots at
// all - the source has no such file - so "below 15 knots" would have promised
// a class of slow, maneuvering vessels that was never in the export.
//
// Only the two fast bands are ever named in a legend. The 10-15 band is drawn
// everywhere, in its basin tint, as the ground the fast traffic sits on.
const speedLegend = [
  { title: '15 to 25 knots', color: C.mid },
  { title: 'Above 25 knots', color: C.fast }
];

const trackLegend = {
  title: 'Tracked whale movements',
  color: C.track,
  symbol: 'line'   // a path, so it reads as a line rather than an area
};

// Shared camera on the basin, so consecutive chapters do not drift.
const MED = [14.0, 38.0];

const config = {
  theme: 'mongabay',

  intro: {
    title: 'Collision course',
    subtitle:
      'Why whales are dying in the Mediterranean shipping lanes.',
    // Provisional: drop datePrefix once the publication date is fixed.
    datePrefix: '(to be?)',
    date: 'August 31, 2026',
    social: [
      { name: 'X', src: 'x.svg', href: 'https://x.com/mongabay' },
      { name: 'facebook', src: 'facebook.svg', href: 'https://www.facebook.com/mongabay/' }
    ]
  },

  logos: [
    // SVG, not the old 136x20 PNG: at width 140 on a retina screen that
    // bitmap was drawn at half the resolution it needed and read as blurry.
    // 140 keeps the same apparent size, because the SVG's ink fills about
    // 81% of its viewBox height and lands back at the PNG's 20px.
    { name: 'mongabay', src: 'mongabaylogo.svg', width: '140', href: 'https://news.mongabay.com' }
  ],

  alignment: 'left',
  footer:
    'Vessel data: Global Fishing Watch (2025) | Habitat boundaries: IUCN IMMA / Pelagos Sanctuary / ACCOBAMS | Whale tracks: Argos satellite telemetry, 2021 to 2024',

  chapters: [

    /* --- 1. Locate the sea ------------------------------------------ */
    {
      id: 'locator',
      alignment: 'left',
      title: 'The Mediterranean: An enclosed sea',
      description:
        'Nearly every ship moving between the Atlantic and the Suez Canal crosses the Mediterranean end to end.',

      // The opening frame does one job: say where this sea is. So the
      // basin itself carries the color and nothing else competes with it -
      // no highlighted countries, no shipping arcs, no graticule.
      globe: {
        center: MED,
        scale: 1,
        opacity: 1,
        duration: 2.2,
        graticule: 0,
        // filled here; from the next chapter on only its coastline is drawn
        data: { mediterranean: 1 }
      }
    },

    /* --- 2. The whole basin is traveled ------------------------------ */
    {
      id: 'basin-traffic',
      alignment: 'left',
      title: 'A sea crossed by many ships',
      description:
        'Each cell below is a patch of sea about ten kilometers across, shaded by how many hours vessels spent in it during 2025.',

      // Everything visible, nothing emphasized. All three bands sit in tints
      // of the ocean color so the reader takes in the extent of the traffic
      // before being told which part of it is dangerous.
      globe: {
        center: MED,
        scale: 2.2,
        opacity: 1,
        duration: 2.4,
        data: {
          medOutline: 1,
          trafficSlow: 1, trafficMid: 1, trafficFast: 1,
          hotSlow: 0, hotMid: 0, hotFast: 0
        }
      }
    },

    /* --- 3. The fast share of it -------------------------------------- */
    {
      id: 'traffic',
      alignment: 'left',
      title: 'High speed traffic',
      description:
        'In 2025 almost 2,800 unique vessels traveled faster than 15 knots while navigating through the Mediterranean’s key whale habitats.',
      legend: speedLegend,

      // Same cells, same camera - only the palette moves. The slow band stays
      // cool so the fast corridors read against the traffic as a whole rather
      // than against an empty sea.
      globe: {
        center: MED,
        scale: 2.2,
        opacity: 1,
        duration: 2.4,
        data: {
          medOutline: 1,
          trafficSlow: 1, trafficMid: 1, trafficFast: 1,
          hotSlow: 0, hotMid: 1, hotFast: 1
        }
      }
    },

    /* --- 4. Why speed matters ----------------------------------------- */
    {
      id: 'threshold',
      type: 'stage',
      stage: 'PlainText',
      alignment: 'left',
      title: '',
      html: `
  <p>
    Ship strikes are almost always fatal when the vessel is traveling above
    15 knots (28 kilometers per hour).
  </p>
`,
      // Hold the camera on the basin and drop the slow band further, so the
      // fast corridors carry the frame while this is read.
      globe: {
        center: MED,
        scale: 2.2,
        opacity: 1,
        data: {
          medOutline: 1,
          trafficSlow: 0.15, trafficMid: 1, trafficFast: 1,
          hotSlow: 0, hotMid: 1, hotFast: 1
        }
      }
    },

    /* --- 5. The three habitats ---------------------------------------- */
    {
      id: 'habitats',
      alignment: 'left',
      title: 'Key whale habitats',
      description:
        'Three areas hold the basin’s most important whale habitat: the Pelagos Sanctuary in the northwest, the Hellenic Trench off southern Greece and the Cetacean Migration Corridor off eastern Spain.',

      globe: {
        center: MED,
        scale: 2.2,
        opacity: 1,
        // The tracks are held back until the next chapter, which draws them
        // on: trackProgress 0 here is what gives that chapter something to
        // animate from.
        data: {
          medOutline: 1, habitats: 1,
          trafficSlow: 0.15, trafficMid: 0.5, trafficFast: 0.8,
          hotSlow: 0, hotMid: 1, hotFast: 1,
          whaleTracks: 0
        },
        trackProgress: 0,
        markers: [
          { coords: [8.6, 42.6], label: 'Pelagos Sanctuary', labelOffset: [12, -30] },
          { coords: [22.4, 36.4], label: 'Hellenic Trench', labelOffset: [16, 28] },
          { coords: [2.4, 40.5], label: 'Migration Corridor', labelOffset: [-14, -8] }
        ]
      }
    },

    /* --- 6. The whales ------------------------------------------------ */
    {
      id: 'whales',
      alignment: 'left',
      title: 'Twelve whales, four years',
      description:
        'Twelve whales were tracked in the Mediterranean between May 2021 and September 2024. Their routes run through the same water as the fast traffic.',
      legend: [trackLegend],

      // The habitats were named in the chapter before this one, so their
      // outlines stay up rather than blinking off and back on. The tracks
      // drawn here stay up for the rest of the story.
      globe: {
        center: MED,
        scale: 2.6,
        opacity: 1,
        duration: 2.0,
        data: {
          medOutline: 1, habitats: 0.9,
          trafficSlow: 0.08, trafficMid: 0.25, trafficFast: 0.45,
          hotSlow: 0, hotMid: 1, hotFast: 1,
          whaleTracks: 1,
          timeline: 1
        },
        // Draws the twelve tracks on across this chapter. The reveal runs on a
        // clock from April 2021 to August 2024, not on each track's length, so
        // the whales appear in the order they were tagged and the month shown
        // under the globe is the real date.
        trackProgress: 1
      }
    },

    /* --- 7-9. Each habitat in turn ------------------------------------ */
    {
      id: 'pelagos',
      alignment: 'left',
      title: 'Pelagos Sanctuary',
      description:
        'France, Italy and Monaco manage the sanctuary jointly, under an agreement signed in 1999. It covers about <strong>96,500 km²</strong>, or 9.65 million hectares. The heaviest shipping runs through the Piombino Channel off Elba, along the Ligurian coast off Nice, and through the Strait of Bonifacio between Corsica and Sardinia.',
      legend: [...speedLegend, trackLegend],

      globe: {
        center: [8.6, 42.6],
        // Closer than the overview. The three scales differ so the habitats
        // come out a comparable size on screen, and each is capped so the
        // whole area still fits a 390px phone - this one is 5.4 deg wide.
        scale: 18,
        opacity: 1,
        duration: 2.0,
        data: {
          medOutline: 1, habitats: 1,
          trafficSlow: 0.2, trafficMid: 1, trafficFast: 1,
          hotSlow: 0, hotMid: 1, hotFast: 1,
          whaleTracks: 1,
          timeline: 0
        },
        trackProgress: 1,
        // Only this habitat is named while the camera is on it, and with no
        // locator dot: at this zoom the outline already says where it is.
        markers: [
          { coords: [8.6, 42.6], label: 'Pelagos Sanctuary', dot: false, labelOffset: [0, -14] }
        ]
      }
    },

    {
      id: 'hellenic',
      alignment: 'left',
      title: 'Hellenic Trench',
      description:
        'Off southern Greece, the trench is critical habitat for sperm whales, which rest at the surface where deep water comes close to shore. It lies in Greek waters and covers about <strong>56,600 km²</strong>, or 5.66 million hectares. Shipping concentrates where vessels round the southern Peloponnese at Cape Malea and Cape Tainaron, and in the Karpathos Strait between Crete and Rhodes.',
      legend: [...speedLegend, trackLegend],

      globe: {
        // The camera centers on the polygon, not on the label. The Hellenic
        // Trench runs from the Ionian at 20E round to Rhodes at 30.4E, so its
        // middle is near 25.2E; centering on the label at 22.4E pushed the
        // eastern third off a phone screen at this zoom.
        center: [25.2, 36.45],
        // Closer than the overview. The three scales differ so the habitats
        // come out a comparable size on screen, and each is capped so the
        // whole area still fits a 390px phone - this one is 10.4 deg wide - the widest of the three.
        scale: 13.5,
        opacity: 1,
        duration: 2.0,
        data: {
          medOutline: 1, habitats: 1,
          trafficSlow: 0.2, trafficMid: 1, trafficFast: 1,
          hotSlow: 0, hotMid: 1, hotFast: 1,
          whaleTracks: 1,
          timeline: 0
        },
        trackProgress: 1,
        // Only this habitat is named while the camera is on it, and with no
        // locator dot: at this zoom the outline already says where it is.
        markers: [
          { coords: [22.4, 36.4], label: 'Hellenic Trench', dot: false, labelOffset: [0, 26] }
        ]
      }
    },

    {
      id: 'corridor',
      alignment: 'left',
      title: 'Cetacean Migration Corridor',
      description:
        'The corridor off eastern Spain protects a migration route between the Balearic Sea and the wider western Mediterranean. Spain declared it a marine protected area in 2018, covering about <strong>46,400 km²</strong>, or 4.64 million hectares. The heaviest traffic runs off Cape de la Nao, where the mainland comes closest to Ibiza, and on the approaches to Valencia and Barcelona.',
      legend: [...speedLegend, trackLegend],

      globe: {
        center: [2.4, 40.5],
        // Closer than the overview. The three scales differ so the habitats
        // come out a comparable size on screen, and each is capped so the
        // whole area still fits a 390px phone - this one is 4.2 deg wide - the most compact.
        scale: 19,
        opacity: 1,
        duration: 2.0,
        data: {
          medOutline: 1, habitats: 1,
          trafficSlow: 0.2, trafficMid: 1, trafficFast: 1,
          hotSlow: 0, hotMid: 1, hotFast: 1,
          whaleTracks: 1,
          timeline: 0
        },
        trackProgress: 1,
        // Only this habitat is named while the camera is on it, and with no
        // locator dot: at this zoom the outline already says where it is.
        markers: [
          { coords: [2.4, 40.5], label: 'Migration Corridor', dot: false, labelOffset: [0, -14] }
        ]
      }
    },

    /* --- 10. The closing note ---------------------------------- */
    {
      id: 'scale',
      type: 'stage',
      stage: 'PlainText',
      alignment: 'left',
      title: '',
      html: `
  <p>Placeholder for an short ending text of this visualization.</p>
`,
      globe: {
        center: MED,
        scale: 2.2,
        opacity: 1,
        duration: 2.0,
        data: {
          medOutline: 1, habitats: 0.7,
          trafficSlow: 0.15, trafficMid: 0.6, trafficFast: 1,
          hotSlow: 0, hotMid: 1, hotFast: 1,
          whaleTracks: 1,
          timeline: 0
        },
        trackProgress: 1
      }
    },

  ]
};

export default config;
