import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      colors: {
        accent: {
          primary: "#6366F1",
          eth:     "#627EEA",
          base:    "#0052FF",
          arb:     "#28A0F0",
        },
        status: {
          success: "#10B981",
          warning: "#F59E0B",
          error:   "#EF4444",
        },
      },
      letterSpacing: {
        tightest: "-0.05em",
        tighter:  "-0.03em",
      },
    },
  },
  plugins: [],
};

export default config;
