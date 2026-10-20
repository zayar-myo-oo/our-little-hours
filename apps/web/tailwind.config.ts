import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#2b1f1a", cream: "#fbf1e3", amber: { glow: "#ffcf8a" }, dusk: "#3a3150" },
      fontFamily: { serif: ["Georgia", "'Times New Roman'", "serif"] },
    },
  },
  plugins: [],
} satisfies Config;
