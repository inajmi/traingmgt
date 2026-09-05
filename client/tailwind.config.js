/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f2e8",
        surface: "#faf7f0",
        ink: "#2c2820",
        muted: "#8a8272",
        sub: "#6b6355",
        line: "#e4ded0",
        line2: "#d8d3c8",
        accent: "#5b6b46",
        ringc: "#8a6a3f",
        danger: "#8a4136",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};