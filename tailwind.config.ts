import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: "#fdf8f0",
          100: "#faefd8",
          200: "#f5dbb0",
          300: "#edc47a",
          400: "#e4a84a",
          500: "#d4891f",
          600: "#b86f12",
          700: "#94540e",
          800: "#724110",
          900: "#5a3310",
        },
        forest: {
          50: "#f0f5f0",
          100: "#d8ebd8",
          200: "#b0d4b0",
          300: "#7ab87a",
          400: "#4a9c4a",
          500: "#2d7d2d",
          600: "#1f6120",
          700: "#174d18",
          800: "#113c12",
          900: "#0d2f0e",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-lora)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
