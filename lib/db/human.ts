import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The human (consultant) client. Auth is out of scope for the prototype —
// a single hardcoded user (CLAUDE.md §4) — so this uses the publishable/anon
// key. Tighten to real per-engagement membership in Phase 1.
export function createHumanClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (see .env.example)",
    );
  }
  return createClient(url, key);
}
