/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hf-dark': '#0a0a0a',
        'hf-card': '#141414',
        'hf-border': '#2a2a2a',
        'hf-green': '#00c853',
        'hf-red': '#ff1744',
        'hf-blue': '#2979ff',
        'hf-gold': '#ffd700',
      }
    },
  },
  plugins: [],
}