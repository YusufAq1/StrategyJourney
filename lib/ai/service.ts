// THE ONLY place the Anthropic SDK may be imported (CLAUDE.md §2 & §4 —
// non-negotiable). No model calls yet: the SWOT and option derivations arrive
// at build Steps 5–6. When they do:
//   - every call is logged to `ai_run` (with `accepted`), and
//   - every AI write goes through withAiServiceRole() in /lib/db/ai.ts so the
//     Rule 3 database boundary applies.
//
// import Anthropic from "@anthropic-ai/sdk";  // ← wired in at Step 5

export {};
