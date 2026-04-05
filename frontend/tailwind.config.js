/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: ['card-enter', 'pulse-green', 'card-loading', 'shake'],
  darkMode: 'class',
  theme: {
    extend: {
      // CSS custom properties (--color-*) are defined in index.css, not Tailwind theme
    },
  },
  plugins: [],
};
