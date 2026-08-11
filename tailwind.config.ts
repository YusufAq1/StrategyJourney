import type { Config } from "tailwindcss";

// Web UI palette extracted from strategyplatforms.com (distinct from the
// PPTX deck theme in /theme/sp-theme.ts, which stays a placeholder pending
// the practice lead's actual PowerPoint template — CLAUDE.md §9).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Violet-tinted neutral scale (replaces stock cool-gray neutral) so every
        // existing bg-neutral-*/text-neutral-*/border-neutral-* class app-wide
        // picks up the brand tint automatically.
        neutral: {
          50: "#F7F8FC",
          100: "#ECEEF6",
          200: "#E1E5F0",
          300: "#C9CEE1",
          400: "#9CA3C2",
          500: "#7B81A3",
          600: "#5F6485",
          700: "#555371",
          800: "#3A3856",
          900: "#171258",
        },
        brand: {
          50: "#F5F2FE",
          100: "#EDE7FD",
          200: "#D9CCFB",
          300: "#BBA3F7",
          400: "#9873F2",
          500: "#6F40F1",
          600: "#5B2FE0",
          700: "#4A24B8",
          800: "#3B1D93",
          900: "#171258",
        },
        coral: "#FF4151",
        skyblue: "#007BFC",
      },
      borderRadius: {
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,18,88,0.04), 0 8px 24px -12px rgba(23,18,88,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
