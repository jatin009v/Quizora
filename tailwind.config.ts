import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#FAF8F5",
        "brand-black": "#0D0D0D",
        "burnt-orange": {
          DEFAULT: "#E05A47",
          hover: "#C94836",
          light: "#FDF0EE",
        },
        "vibrant-pink": {
          DEFAULT: "#FF2A85",
          hover: "#E01870",
          light: "#FFF0F6",
        },
        "deep-blue": {
          DEFAULT: "#1E293B",
          dark: "#0F172A",
          accent: "#2563EB",
          light: "#F1F5F9",
        },
        "warm-beige": {
          DEFAULT: "#F4EFE6",
          dark: "#E8E0D2",
          light: "#FCF9F5",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      boxShadow: {
        editorial: "4px 4px 0px #0D0D0D",
        "editorial-lg": "8px 8px 0px #0D0D0D",
        "editorial-orange": "4px 4px 0px #E05A47",
        "editorial-pink": "4px 4px 0px #FF2A85",
        "editorial-blue": "4px 4px 0px #1E293B",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
