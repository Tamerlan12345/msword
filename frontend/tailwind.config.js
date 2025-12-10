/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#005f73', // Deep blue/teal
          light: '#0a9396',
          dark: '#001219',
        },
        accent: {
          DEFAULT: '#94d2bd', // Bright green/blueish
          hover: '#0a9396',
        },
        error: '#ae2012',
        background: '#f5f6f8',
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'Open Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
