const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  /* Purge.
     Without this Tailwind emits its entire default utility set: 2.0 MB raw,
     181 kB gzipped, which was larger than the whole application bundle. Every
     Tailwind class in this project is a literal string in a .js file (there is
     no `'text-' + size` construction anywhere), so PurgeCSS's text scan finds
     all of them. The classes built from template literals - reading-progress--,
     footer-, flip-gallery - come from the SCSS files, which this build never
     touches.
     `enabled: true` rather than production-only, so dev and the deploy render
     from exactly the same stylesheet and a missing class cannot hide until
     after a push. */
  purge: {
    enabled: true,
    content: ['./src/**/*.js', './src/**/*.jsx', './public/index.html'],
  },
  fontFamily: {
    display: ['Lora', 'Open Sans', ...defaultTheme.fontFamily.sans],
    body: ['Lora', 'Open Sans', ...defaultTheme.fontFamily.sans],
  },
  theme: {
    extend: {
      colors: {
        primary: '#03755E',
        mongazon: '#F1BA30',
      },
      borderWidth: {
        0.75: '0.75px',
      },
      fontSize: {
        '2xl': '2rem',
      },
    },
  },
};
