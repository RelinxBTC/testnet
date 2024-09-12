const plugin = require('tailwindcss/plugin')

/** @type {import('tailwindcss').Config} */
export default {
  content: [`./index.html`, `./{src,public,dashboard/src}/**/*.{ts,tsx,js,jsx,html,css,scss,sass}`],
  theme: {
    extend: {}
  },
  plugins: [
    plugin(function ({ addBase, theme }) {
      addBase({
        h1: { fontSize: theme('fontSize.2xl') },
        h2: { fontSize: theme('fontSize.xl') },
        h3: { fontSize: theme('fontSize.lg') }
      })
    })
  ]
}
