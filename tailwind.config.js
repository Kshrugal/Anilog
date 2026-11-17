/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './*.tsx', './features/**/*.{ts,tsx}', './services/**/*.{ts,tsx}'],
  safelist: ['blue-500', 'lime-500', 'rose-500', 'indigo-500', 'orange-500', 'white', 'emerald-500'].map(color => `focus:ring-${color}/30`),
  theme: { extend: {} },
  plugins: [],
};
