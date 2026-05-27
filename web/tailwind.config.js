/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#eab308',
          dark: '#a16207',
          light: '#fde047',
        },
      },
    },
  },
  plugins: [],
};
