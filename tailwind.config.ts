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
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: "#F5F4F0",
        ink: "#1A1A18",
        stone: "#888780",
        "border-light": "#E8E6E0",
        honey: "#E8A04A",
        ocean: "#3D7EAA",
        sage: "#5BAD7F",
        terra: "#D96B5A",
        lavender: "#9B8EC4",
        rose: "#E8416A",
      },
      gridTemplateColumns: {
        board: "3fr 2fr",
        mirror: "1fr 1.4fr 1fr",
      },
      spacing: {
        section: "30px",
        "label-gap": "12px",
        row: "7px",
      },
    },
  },
  plugins: [],
};
export default config;
