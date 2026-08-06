# ADR 0009 — Multi-client workspace and client handover

**Status:** Accepted (post-prototype, Step 9)

## Context
The prototype ran against one seeded engagement (Meridian). Two new needs arose: (1) the workspace must serve many clients from a landing screen with a create-new-client flow, and (2) the whole thing must be handed to the end client to run on *their* accounts and keys, driven by a non-technical README.

Exploration showed the workspace was already engagement-parameterized: every Server Action takes `engagementId` from its form, all graph data is scoped by `node.engagement_id` (with `on delete cascade` and the `assert_edge_same_engagement` guard), and the deck is a shared **house** template (`deck_template.engagement_id` nullable, `= null`). So the graph, the deck, and provenance already isolate clients correctly. The gaps were a front door, a create path, one missing intake path, and docs.

## Decision
- **No new isolation machinery.** Rely on the existing `engagement_id` scoping and cross-engagement edge guard. A new client is just another `engagement` row plus its own nodes.
- **`0005_multi_client.sql`** adds `engagement.industry` + `description`, and two SECURITY INVOKER functions mirroring `create_signal`/`create_insight` (ADR 0006):
  - `create_engagement(...)` — inserts the engagement and, when `p_seed_starter`, a generic cross-industry **starter capability inventory** so a new client's Capabilities page and heatmap work immediately.
  - `create_capability(...)` — the previously missing path to add a capability (node + typed row + initial score) by hand. Capability nodes are `origin='human'`, `type='capability'`, which the `human_intake` policy already permits (`type <> 'option'`, 0004).
  - Explicit `grant insert on engagement/capability/capability_score to anon`, so the human create path is self-documenting rather than relying on Supabase's implicit default grants.
- **Landing page** (`app/page.tsx`) replaces the old redirect-to-demo with a list of all engagements + a "New client" button; Meridian is tagged as Demo by id.
- **Handover target: Netlify**, chosen with the user over Vercel. Same caveat as Vercel — neither runs in `me-central-1`, so this remains the interim host and CLAUDE.md §4 / ADR 0005 (containerize to AWS me-central-1) still governs true production. `netlify.toml` declares `@netlify/plugin-nextjs`; the three runtime env vars are set in the Netlify UI.
- **Handover method: transfer the live services, not rebuild.** The app is already built on the outgoing owner's Supabase + Netlify accounts, so the README leads with **transferring** them to the client (Supabase project transfer keeps the same ref/URL/keys/data; Netlify site transfer keeps the same URL). Only the Anthropic key is swapped, because API billing is per-account and cannot be transferred — which is also the whole of "keys become the client's" (Supabase keys become theirs by owning the project). The from-scratch provisioning (five migrations + optional seed) is retained only as a fallback / independent-copy path.
- **Auth stays out of scope.** Per the user's explicit "no login", the single hardcoded user is retained. The README states plainly that anyone with the URL sees all clients.

## Consequences
- Rule 3 is unchanged and still a permission boundary: `create_engagement`/`create_capability` run as the human (anon) path and cannot fabricate a choice or a machine option.
- Client isolation is inherited, not re-implemented — verified by confirming new-client nodes carry the new `engagement_id` and Meridian is untouched.
- The starter template means new clients are never blank, at the cost of a fixed default set the consultant must curate; it is fully editable/removable via the add-capability UI.
- `industry`/`description` are the only schema growth; they surface in the header and on the cover slide (`engagement.meta()`).
- Handover is primarily a set of ownership transfers the two parties do together once (Supabase project, Netlify site, optionally the GitHub repo) plus swapping in the client's Anthropic key and redeploying; the from-scratch SQL-editor path remains documented as the fallback.
