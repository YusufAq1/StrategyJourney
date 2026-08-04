# Kickoff prompt

Paste this as your first message to Claude Code in the repo root.

---

```
Read CLAUDE.md in full, then read the six companion documents it lists. Do not
write any code until you have read all of them.

This is a prototype of a Consultant Workspace for a strategy consultancy. It
must prove one thing: that a generated PowerPoint slide can answer "why is this
here?" with a traceable chain back to sourced evidence — and that the deck looks
good enough that a strategist won't rebuild it in PowerPoint.

Start with step 1 of the build order in CLAUDE.md §12: get the database
standing up and the assertions passing.

Specifically:

1. Scaffold the Next.js 15 + TypeScript + Tailwind + Supabase project using the
   directory layout and pinned package.json already in the repo. Do not upgrade
   or substitute any pinned dependency without telling me why.

2. Run `supabase start` and `npm run db:reset` to apply migration 0001.

3. Run `npm run db:assert`. The migration has never been executed — it was
   written by inspection, so expect failures. Work through them one at a time.
   For each failure, tell me:
     - which assertion failed
     - whether the defect is in the migration or in the assertion
     - your fix
   Do not weaken an assertion to make it pass. If an assertion is genuinely
   wrong, say so explicitly and explain why before changing it.

4. Load supabase/seed.sql and confirm node_provenance() returns a sensible
   chain for insight 00000000-0000-0000-0000-0000000000c1.

5. Write the critical test suite in /tests/critical: intake enforcement, the
   ai_service write restriction, and RLS isolation. These run on every commit.

Then stop and report. Do not proceed to step 2 of the build order.

Three standing constraints for this whole project:

- The ai_service role must never be able to insert or update a `choice` node or
  write `decision_log`. If you find yourself needing to relax this to make
  something work, stop and ask me — you have found a design problem, not a
  permissions problem.

- Every Anthropic API call goes through /lib/ai/service.ts. No exceptions.
  No direct SDK imports elsewhere.

- No Vercel-only primitives (Edge Config, Vercel KV, Vercel Blob). The
  production system needs an in-region AWS deployment path and these do not
  travel. Use Supabase Storage and Postgres.

When you are unsure whether something is in scope, check CLAUDE.md §4. If it is
on the out-of-scope list, do not build it — flag it and move on.
```

---

## What to say at each subsequent step

**Step 2 (theme + slide 1)** — do not start until you have the SP PowerPoint template file.

```
Extract the theme from the attached SP PowerPoint template into /theme/sp-theme.ts:
colour palette with semantic names, font families and sizes by role, slide
dimensions, margin and grid geometry. Then build the deck composer skeleton and
render slide 1 (cover) as an editable PPTX. Open it and verify text is editable
and the theme matches. Show me the output file.
```

**Step 3 (signals, insights, provenance)**

```
Build signal intake, insight capture and the provenance viewer per CLAUDE.md
§3 modules 2, 3 and 10. Signal intake must make the source and date fields
impossible to skip — enforce in the form, in the API, and rely on the DB
trigger as backstop. The provenance viewer is the §1 test made visible: clicking
any node shows the full upstream chain with sources and dates.
```

**Step 4 onward** — follow the build order table in CLAUDE.md §12. One step per session; end each with a demo of the step's exit condition.

---

## Things to hold Claude Code to

- **Never let it weaken a schema assertion to make a test pass.** That is the one failure mode that silently destroys the guarantees.
- **Never let it add a rank or score column to `option_detail`.** There is nowhere to put a preference, deliberately.
- **Never let it inline a prompt** in application code. Prompts are versioned files.
- **Make it show you the PPTX** after every deck change, not a description of the PPTX.
- **If it proposes building something on the out-of-scope list**, that is scope creep dressed as thoroughness.

---

## Still outstanding, not Claude Code's problem

| Item | Owner | Blocks |
|---|---|---|
| SP PowerPoint template → `/theme/sp-theme.ts` | Practice lead | Build step 2 |
| Real signals from a past engagement (replace seed.sql) | Practice lead | Honest evaluation of step 5 |
| Anthropic API key | You | Steps 5–6 |
| Appendix C items 1, 2, 4, 5, 7 | Consultant | Phase 1, not the prototype |
