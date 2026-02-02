/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        visionary: '#3b82f6',
        analyst: '#9ca3af',
        realist: '#f97316',
        guardian: '#ef4444',
        moderator: '#22c55e',
      }
    },
  },
  plugins: [],
}
