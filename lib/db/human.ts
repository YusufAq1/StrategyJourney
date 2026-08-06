import { cache } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The human (consultant) client. Auth is out of scope for the prototype —
// a single hardcoded user (CLAUDE.md §4) — so this uses the publishable/anon
// key. Tighten to real per-engagement membership in Phase 1.
//
// Wrapped in React cache() so the shared workspace layout and the page it wraps
// reuse one client per request instead of constructing a new createClient() on
// every call. cache() is a no-op outside a request (e.g. scripts), which is fine.
export const createHumanClient = cache((): SupabaseClient => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set (see .env.example)",
    );
  }
  return createClient(url, key);
});
