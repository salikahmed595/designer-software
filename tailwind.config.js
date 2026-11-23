/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#0b0e0c', 900: '#111512', 850: '#151a17', 800: '#1b211d', 700: '#28302b', 600: '#3a433d' },
        lime: { brand: '#9cfb59', deep: '#5fd13a' },
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'] },
    },
  },
  plugins: [],
};
