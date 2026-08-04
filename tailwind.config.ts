import type { Config } from "tailwindcss";

// SP theme tokens land in /theme/sp-theme.ts at build Step 2 and get wired in
// here then. For Step 1 this is a stock Tailwind 3 setup.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
