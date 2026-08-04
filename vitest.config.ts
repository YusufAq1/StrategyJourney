import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// Load .env.local so the DB-backed critical tests see DATABASE_URL etc.
config({ path: ".env.local" });

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
