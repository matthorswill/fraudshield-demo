/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0B0F14",
        muted: "#94A3B8",
        primary: "#4F46E5",
        hover: "rgba(79,70,229,0.12)",
      }
    },
  },
  plugins: [],
};

