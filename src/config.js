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
const trackLegend = {
  title: 'Tracked whale movements',
  color: C.track,
  symbol: 'line'   // a path, so it reads as a line rather than an area
};

const config = {
  // The style carries the basemap and the story's own layers.
  style: 'mapbox://styles/mongabay/cmtkharki000k01qydbisf6f0',
  // Read from .env, which is gitignored, so the token never enters the repo.
  // See .env.template for the variable name.
  accessToken: process.env.REACT_APP_MAPBOX_ACCESS_TOKEN,
  showMarkers: false,

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

    /* --- 1. The sea itself -------------------------------------------- */
    // The first pinned panel. The image holds still while the three steps
    // beside it change: where this sea is, how heavily it is travelled, and
    // how much of that traffic is fast.
    {
      id: 'mediterranean',
      type: 'stage',
      stage: 'PinnedPanel',
      eyebrow: 'The Mediterranean',
      title: 'An enclosed sea',
      // 16:9, because the basin is far wider than it is tall and a square
      // frame would crop it to a fragment.
      aspect: '16 / 9',
      locator: [15.25, 38.0],
      place: 'Mediterranean Sea',
      // Rendered from this project's own Mapbox style, so the bar is exact:
      // 500 km is 5.5% of the panel's width at the zoom the image was made at.
      // See Scripts/ for the renderer.
      scale: { n: 500, kmFrac: 0.055, miFrac: 0.0885 },
      steps: [
        {
          image: '/panels/mediterranean.jpg',
          label: 'An enclosed sea',
          text: 'Nearly every ship moving between the Atlantic and the Suez Canal crosses the Mediterranean end to end.',
        },
        {
          image: '/panels/mediterranean.jpg',
          label: 'A sea crossed by many ships',
          text: 'Almost none of the basin is empty. Of the roughly 25,200 patches of sea ten kilometers across that make up the Mediterranean, <strong>24,254</strong> carried vessel traffic during 2025.',
        },
        {
          image: '/panels/mediterranean.jpg',
          label: 'High speed traffic',
          text: 'In 2025 almost <strong>2,800 unique vessels</strong> traveled faster than 15 knots while navigating through the Mediterranean\u2019s key whale habitats.',
        },
      ],
      location: { center: [15.25, 38.0], zoom: 4.1, pitch: 0, bearing: 0 },
      mapAnimation: 'easeTo',
    },

    /* --- 2. Why speed matters ----------------------------------------- */
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
      location: { center: [15.25, 38.0], zoom: 4.1, pitch: 0, bearing: 0 },
      mapAnimation: 'easeTo',
    },

    /* --- 3. The three habitats ---------------------------------------- */
    {
      id: 'habitats',
      alignment: 'left',
      card: true,
      title: 'Key whale habitats',
      description:
        'Three areas hold the basin\u2019s most important whale habitat: the Pelagos Sanctuary in the northwest, the Hellenic Trench off southern Greece and the Cetacean Migration Corridor off eastern Spain.',
      location: { center: [15.25, 38.5], zoom: 4.3, pitch: 0, bearing: 0 },
      mapAnimation: 'flyTo',
    },

    /* --- 4-6. Each habitat in turn ------------------------------------ */
    {
      id: 'pelagos',
      type: 'stage',
      stage: 'PinnedPanel',
      eyebrow: 'Key whale habitat',
      title: 'Pelagos Sanctuary',
      aspect: '4 / 3',
      locator: [8.81, 42.625],
      place: 'France, Italy, Monaco',
      scale: { n: 100, kmFrac: 0.0765, miFrac: 0.1231 },
      steps: [
        {
          image: '/panels/pelagos.jpg',
          label: 'Jointly managed',
          text: 'France, Italy and Monaco manage the sanctuary together, under an agreement signed in 1999. It covers about <strong>96,500 km\u00b2</strong>, or 9.65 million hectares.',
        },
        {
          image: '/panels/pelagos.jpg',
          label: 'Where the ships run',
          text: 'The heaviest shipping runs through the Piombino Channel off Elba, along the Ligurian coast off Nice, and through the Strait of Bonifacio between Corsica and Sardinia.',
        },
      ],
      location: { center: [8.81, 42.625], zoom: 6.4, pitch: 0, bearing: 0 },
      mapAnimation: 'flyTo',
    },

    {
      id: 'hellenic',
      type: 'stage',
      stage: 'PinnedPanel',
      eyebrow: 'Key whale habitat',
      title: 'Hellenic Trench',
      aspect: '4 / 3',
      locator: [25.2, 36.445],
      place: 'Greece',
      scale: { n: 200, kmFrac: 0.088, miFrac: 0.1417 },
      steps: [
        {
          image: '/panels/hellenic.jpg',
          label: 'Critical for sperm whales',
          text: 'Off southern Greece, the trench is critical habitat for sperm whales, which rest at the surface where deep water comes close to shore. It lies in Greek waters and covers about <strong>56,600 km\u00b2</strong>, or 5.66 million hectares.',
        },
        {
          image: '/panels/hellenic.jpg',
          label: 'Where the ships run',
          text: 'Shipping concentrates where vessels round the southern Peloponnese at Cape Malea and Cape Tainaron, and in the Karpathos Strait between Crete and Rhodes.',
        },
      ],
      location: { center: [25.2, 36.445], zoom: 5.8, pitch: 0, bearing: 0 },
      mapAnimation: 'flyTo',
    },

    {
      id: 'corridor',
      type: 'stage',
      stage: 'PinnedPanel',
      eyebrow: 'Key whale habitat',
      title: 'Cetacean Migration Corridor',
      aspect: '4 / 3',
      locator: [2.45, 40.495],
      place: 'Spain',
      scale: { n: 100, kmFrac: 0.0757, miFrac: 0.1218 },
      steps: [
        {
          image: '/panels/corridor.jpg',
          label: 'A protected route',
          text: 'The corridor off eastern Spain protects a migration route between the Balearic Sea and the wider western Mediterranean. Spain declared it a marine protected area in 2018, covering about <strong>46,400 km\u00b2</strong>, or 4.64 million hectares.',
        },
        {
          image: '/panels/corridor.jpg',
          label: 'Where the ships run',
          text: 'The heaviest traffic runs off Cape de la Nao, where the mainland comes closest to Ibiza, and on the approaches to Valencia and Barcelona.',
        },
      ],
      location: { center: [2.45, 40.495], zoom: 6.5, pitch: 0, bearing: 0 },
      mapAnimation: 'flyTo',
    },

    /* --- 7. The whales ------------------------------------------------ */
    {
      id: 'whales',
      alignment: 'left',
      card: true,
      title: 'Twelve whales, four years',
      description:
        'Twelve whales were tracked in the Mediterranean between May 2021 and September 2024. Their routes run through the same water as the fast traffic.',
      legend: [trackLegend],
      location: { center: [15.25, 38.5], zoom: 4.3, pitch: 0, bearing: 0 },
      mapAnimation: 'flyTo',
    },

    /* --- 8. The closing note ------------------------------------------ */
    {
      id: 'closing',
      type: 'stage',
      stage: 'PlainText',
      alignment: 'left',
      title: '',
      html: `
  <p>Placeholder for a short ending text of this visualization.</p>
`,
      location: { center: [15.25, 38.0], zoom: 4.1, pitch: 0, bearing: 0 },
      mapAnimation: 'easeTo',
    },

  ]
};

export default config;
