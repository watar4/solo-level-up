/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8ec1ff',
          400: '#599dff',
          500: '#3577f5',
          600: '#1f59db',
          700: '#1a47b1',
          800: '#1b3e8c',
          900: '#1c376f',
        },
      },
    },
  },
  plugins: [],
};
