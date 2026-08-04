import { Client, type ClientConfig } from "pg";

// Raw Postgres access. Used where PostgREST/supabase-js cannot express what we
// need — notably assuming a specific Postgres role to exercise the Rule 3
// boundary (see ./ai.ts) and the critical tests in /tests/critical.
export function pgConfig(): ClientConfig {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (see .env.example)");
  }
  // Supabase hosted requires TLS. rejectUnauthorized:false keeps dev simple;
  // pin the CA on the AWS/self-hosted path at Phase 1.
  return { connectionString, ssl: { rejectUnauthorized: false } };
}

export async function withPgClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client(pgConfig());
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
