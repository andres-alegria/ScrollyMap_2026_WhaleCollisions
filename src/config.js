/* ------------------------------------------------------------------
   Story configuration.

   Version 2. The basemap is Mapbox again, and the story is told through
   PinnedPanel sections adapted from the isolated-peoples scrolly: an
   image panel held on the left while the image inside it and the
   paragraph beside it step through together.

   A chapter is one of three things:
     - a plain chapter, a card over the map, with a `location` camera
     - a stage, `type: 'stage'` plus a `stage` name from the registry
     - a PinnedPanel stage, which carries its own `steps`

   The D3 globe that carried version 1 is gone from the app shell. Its
   code is still in src/components/globe/ and the data it drew is still
   in public/data, so nothing is lost if any of it is wanted back.
   ------------------------------------------------------------------ */

// The bands are 10-15 / 15-25 / >25 knots. There is no data below 10 knots at
// all - the source has no such file - so "below 15 knots" would have promised
// a class of slow, maneuvering vessels that was never in the export.
//
// The basemap style, and the token from .env - which is gitignored, so the
// token never enters the repo. See .env.template for the variable name.
const MAPBOX_STYLE = 'mapbox://styles/mongabay/cmtkharki000k01qydbisf6f0';
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

const config = {
  style: MAPBOX_STYLE,
  accessToken: MAPBOX_TOKEN,

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
  // The footer is now just the strip the logo sits on; the sources moved into
  // the credits section above it, following the reference piece.
  footer: '',

  credits: {
    backToStart: 'Back to the start',
    title: 'Credits',
    people: [
      { role: 'Reporting', name: 'TBC' },
      { role: 'Data Editor and Designer', name: 'Andrés Alegría' },
    ],
    sourcesTitle: 'Sources',
    sources:
      'Vessel positions are from Global Fishing Watch, covering 2025, gridded '
      + 'at 0.1 degrees and split into three speed bands. Habitat boundaries '
      + 'come from the IUCN Marine Mammal Protected Areas Task Force (IMMA), '
      + 'the Pelagos Sanctuary and ACCOBAMS. Whale movements are Argos '
      + 'satellite telemetry from twelve tagged animals, 2021 to 2024.',
  },

  chapters: [

    /* --- Locating the sea --------------------------------------------- */
    // The only full-screen map in the piece. It opens on the world and closes
    // on the basin as the section is entered; once the camera has arrived the
    // card rises from the bottom edge. Short and full width on purpose, so
    // the map keeps the screen and the card reads as a caption to it.
    {
      id: 'locator',
      type: 'stage',
      stage: 'MapIntro',
      accessToken: MAPBOX_TOKEN,
      mapStyle: MAPBOX_STYLE,
      from: { center: [15, 30], zoom: 1.5 },
      to: { center: [15.25, 38], zoom: 3.5 },
      eyebrow: 'The Mediterranean',
      label: 'A sea crossed by many ships',
      text: 'Nearly every ship moving between the Atlantic and the Suez Canal crosses this sea end to end, and almost none of it is empty: of the roughly 25,200 patches of water ten kilometers across that make up the Mediterranean, <strong>24,254</strong> carried vessel traffic during 2025.',
    },

    /* --- The story, in one box ---------------------------------------- */
    // A single pinned panel. The box never moves and the story never hands
    // off to a second one: the camera travels inside the frame while the
    // paragraph beside it changes to match. Each step carries both, so they
    // cannot drift apart.
    //
    // Cameras are interpolated between steps rather than flown, so the map
    // tracks the scroll exactly and reverses cleanly when the reader scrolls
    // back up.
    {
      id: 'story-map',
      type: 'stage',
      stage: 'MapPanel',
      accessToken: MAPBOX_TOKEN,
      mapStyle: MAPBOX_STYLE,
      aspect: '4 / 3',
      dwell: 1.6,              // adjust: screen-heights of scroll per step
      // Each step's `traffic` block says how present each speed band is, as a
      // fraction of the strength the Mapbox style gives it. Color, radius and
      // stroke are Studio's; this only decides what the reader is looking at.
      // Values interpolate between steps with the camera, so a band fades in
      // over the same stretch the camera travels.
      //
      // Three more values work the same way, for the layers the story draws
      // itself from GeoJSON:
      //   habitats  0-1  how present the three habitat outlines are
      //   habitat   the one drawn solid, by title, rather than dashed
      //   tracks    0-1  how present the whale tracks are
      //   clock     0-1  how much of the tagging record has been revealed.
      //             Two steps sharing a camera turn this into a reveal that
      //             plays while the map holds still.
      steps: [
        {
          center: [15.25, 38.0], zoom: 4.1,
          place: 'Mediterranean Sea',
          traffic: { slow: 0.75, mid: 1, fast: 1 },
          eyebrow: 'The Mediterranean',
          label: 'High speed traffic',
          text: 'In 2025 almost <strong>2,800 unique vessels</strong> traveled faster than 15 knots while navigating through the Mediterranean\u2019s key whale habitats. Ship strikes are almost always fatal above that speed, about 28 kilometers per hour.',
        },
        {
          center: [8.81, 42.625], zoom: 6.3,
          place: 'France, Italy, Monaco',
          traffic: { slow: 0.35, mid: 1, fast: 1 },
          habitats: 1,
          habitat: 'Pelagos Sanctuary',
          eyebrow: 'Key whale habitat',
          label: 'Pelagos Sanctuary',
          text: 'France, Italy and Monaco manage the sanctuary together, under an agreement signed in 1999. It covers about <strong>96,500 km\u00b2</strong>. The heaviest shipping runs through the Piombino Channel off Elba, along the Ligurian coast off Nice, and through the Strait of Bonifacio.',
        },
        {
          center: [25.2, 36.445], zoom: 5.7,
          place: 'Greece',
          traffic: { slow: 0.35, mid: 1, fast: 1 },
          habitats: 1,
          habitat: 'Hellenic Trench',
          eyebrow: 'Key whale habitat',
          label: 'Hellenic Trench',
          text: 'Off southern Greece, the trench is critical habitat for sperm whales, which rest at the surface where deep water comes close to shore. It covers about <strong>56,600 km\u00b2</strong>. Shipping concentrates where vessels round the southern Peloponnese, and in the Karpathos Strait.',
        },
        {
          center: [2.45, 40.495], zoom: 6.4,
          place: 'Spain',
          traffic: { slow: 0.35, mid: 1, fast: 1 },
          habitats: 1,
          habitat: 'Cetacean Migration Corridor',
          eyebrow: 'Key whale habitat',
          label: 'Cetacean Migration Corridor',
          text: 'The corridor off eastern Spain protects a migration route between the Balearic Sea and the wider western Mediterranean. Spain declared it a marine protected area in 2018, covering about <strong>46,400 km\u00b2</strong>.',
        },
        {
          center: [15.25, 38.5], zoom: 4.0,
          place: 'Mediterranean Sea',
          // the traffic drops back so the tracks can be seen against it
          traffic: { slow: 0.2, mid: 0.4, fast: 0.7 },
          habitats: 0.5,
          tracks: 1, clock: 0,
          eyebrow: 'Tracked movements',
          label: 'Twelve whales, four years',
          text: 'Twelve whales were tracked in the Mediterranean between May 2021 and September 2024. Their routes run through the same water as the fast traffic.',
        },
        // Same camera as the step above, so the map holds still and the only
        // thing that moves is the clock. This is the reveal.
        {
          center: [15.25, 38.5], zoom: 4.0,
          place: 'Mediterranean Sea',
          traffic: { slow: 0.2, mid: 0.4, fast: 0.7 },
          habitats: 0.5,
          tracks: 1, clock: 1,
          eyebrow: 'Tracked movements',
          label: 'Twelve whales, four years',
          text: 'Twelve whales were tracked in the Mediterranean between May 2021 and September 2024. Their routes run through the same water as the fast traffic.',
        },
      ],
    },

    /* --- The closing note --------------------------------------------- */
    {
      id: 'closing',
      type: 'stage',
      stage: 'PlainText',
      alignment: 'left',
      title: '',
      html: `
  <p>Placeholder for a short ending text of this visualization.</p>
`,
    },

  ]
};

export default config;
