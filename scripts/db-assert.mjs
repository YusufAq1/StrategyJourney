// Cross-platform runner for the schema assertion suite.
// The original `psql "$DATABASE_URL" ...` script assumed a POSIX shell; on
// Windows/PowerShell the $VAR does not expand. This wrapper loads .env.local
// and invokes psql with the same file and flags, unchanged.
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

const res = spawnSync(
  "psql",
  [url, "-v", "ON_ERROR_STOP=1", "-f", "supabase/tests/0001_schema_assertions.sql"],
  { stdio: "inherit" },
);

if (res.error) {
  console.error(
    "Could not run psql. Is the PostgreSQL client installed and on PATH? " +
      "(winget install PostgreSQL.PostgreSQL.17)",
  );
  console.error(res.error.message);
  process.exit(1);
}
process.exit(res.status ?? 1);
