# Strategy Journey Platform — Consultant Workspace

A web app for building client strategies where **every conclusion can be traced back to evidence**. You capture sourced facts, turn them into insights, assess the client's capabilities, let the app draft a SWOT and a set of growth options, record the human decision, and generate an editable PowerPoint deck — and at any point you can click any item and ask *"why is this here?"* and see the chain back to the dated, sourced facts it rests on.

You can run it for as many clients as you like. Each client is kept completely separate.

---

## What it runs on

Three services. You don't need to understand the internals — just know what each is:

| Service | What it does | Cost |
|---|---|---|
| **Netlify** | Hosts the website you open in a browser. | Free to start |
| **Supabase** | Hosts the database where all client data lives. | Free to start |
| **Anthropic (Claude)** | The AI that drafts the SWOT and the growth options. | Pay per use (cents per draft) |

---

## Part A — Handover: transfer the live app (recommended)

The app is **already built and running** on the previous owner's Netlify and Supabase accounts. The clean way to hand it over is to **transfer those to you** — you get the working app, with all its data and settings intact, running on **your** accounts. Nothing is rebuilt.

> **Terminology:** below, **"the outgoing owner"** is whoever currently runs the app (the consultant handing it over) and **"you"** is the person receiving it. The two of you do this together once; it takes about 20 minutes.

### Step 1 — You create three free accounts

Just sign up — no setup:
- **[supabase.com](https://supabase.com)** — then create one **new, empty organization** (e.g. "My Company"). Leave it empty.
- **[netlify.com](https://netlify.com)** — then create a **team** (Netlify may make one for you automatically; that's fine).
- **[console.anthropic.com](https://console.anthropic.com)** — add a payment method and a little credit, then create an **API key** (starts with `sk-ant-...`). Keep it for Step 4.

### Step 2 — You invite the outgoing owner into your Supabase org and Netlify team

Transfers are only allowed between accounts that share a member, so add them temporarily:
- **Supabase:** in your new organization → **Organization settings → Team → Invite**, and invite the outgoing owner by email (role: Owner or Administrator).
- **Netlify:** in your team → **Team settings → Members → Invite**, invite them (role: Owner or Developer).

They accept both invites.

### Step 3 — The outgoing owner transfers the project and the site to you

- **Supabase (the database):** in the project → **Project Settings → General → Transfer project** → choose **your** organization → confirm. The database, all its data, its web address, **and its keys stay exactly the same** — only who owns and pays changes.
- **Netlify (the website):** in the site → **Project configuration → General → Project information → Transfer project** → choose **your** team → confirm. The live web address (`...netlify.app`) stays the same.
- **The code (GitHub), optional but recommended:** the outgoing owner transfers the code repository to your GitHub account (**repo → Settings → Danger Zone → Transfer ownership**). This matters only if you'll ever have a developer update the app later; the running site works regardless.

### Step 4 — You put in your own Anthropic key and redeploy

Billing for the AI can't be transferred (it's tied to an account), so this is the one key you set yourself:
1. In your Netlify site → **Project configuration → Environment variables**.
2. Make sure these three exist; set `ANTHROPIC_API_KEY` to **your** key from Step 1:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (unchanged — already correct after the transfer) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (unchanged — already correct after the transfer) |
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key |

3. Go to **Deploys → Trigger deploy → Deploy project** so the new key takes effect.
4. Open your site's web address. You should see the **Clients** screen with the demo client "Meridian Logistics".

### Step 5 — Remove the outgoing owner (once it's working)

When you've confirmed the site works on your accounts, remove the outgoing owner from your Supabase org and Netlify team (same Members screens as Step 2). Everything now runs entirely on your accounts, and only you are billed.

> **After this, the keys are yours:** the Supabase keys became yours the moment you owned the project, and the Anthropic key is the one you set in Step 4. You can rotate any of them anytime in Netlify's Environment variables (then redeploy).

---

## Part B — Alternative: build a fresh copy from scratch

You only need this if a transfer isn't possible, or you want a brand-new independent copy (e.g. a second environment). It builds an empty app on your own accounts from the code.

1. **Database (Supabase):** create a project. Open the **SQL Editor** and run these five files from `supabase/migrations/`, **in order**, pasting each one's full contents and clicking Run: `0001_prototype_schema.sql`, `0002_human_access_and_intake.sql`, `0003_swot_apply.sql`, `0004_options_and_choice.sql`, `0005_multi_client.sql`. To load the demo client, also run `supabase/seed.sql`. Then from **Project Settings → API** copy the **Project URL** and the **anon public** key.
2. **AI key (Anthropic):** create an API key at [console.anthropic.com](https://console.anthropic.com).
3. **Website (Netlify):** put this project's code in a GitHub repo you own, then in Netlify **Add new project → Import an existing project** and pick it. Under **Environment variables** add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ANTHROPIC_API_KEY`, then **Deploy**.

(A developer with the Supabase CLI can do the database step in one command: `supabase db reset` applies all migrations plus the seed.)

> **Prefer to run it on your own computer instead of hosting it?** Install [Node.js](https://nodejs.org), copy `.env.example` to `.env.local` and fill in the same three values, then run `npm install` and `npm run dev`, and open `http://localhost:3000`.

---

## Part C — How to use the app

### The Clients screen

The first screen lists every client you're working on. Click a client's card to open their workspace. Click **+ New client** to add one.

### Adding a new client

Click **+ New client**, then fill in:
- **Client company** and **Industry** — who they are.
- **Engagement name** — what this piece of work is called.
- **Company description** — a sentence or two of context.
- **Planning horizon** — e.g. "3 years".
- **Key strategic questions** — the questions this strategy must answer, one per line.

Press **Create client & start**. The app sets them up with a **starter set of business capabilities** already in place (so nothing is blank) and drops you into their **Signals** tab to begin.

### Building the strategy (work the tabs left to right)

Each tab builds on the one before, and the app won't let you skip the evidence.

1. **Signals** — the sourced facts. Each one needs a source (a web link *or* an interview reference like "CFO, on this date") and a date. You cannot save a fact without saying where it came from.
2. **Insights** — your interpretations. Each must link to at least one signal.
3. **Capabilities** — how the client measures up. Score each capability's current vs. required maturity; the heatmap shows the gaps. Use **+ Add capability** to add your own, or edit the starter set.
4. **SWOT** — click **Derive SWOT** and the AI drafts it from your capabilities and signals. Every item shows the evidence it came from. You edit the wording; deleting an item asks you why (so evidence is never quietly dropped).
5. **Options** — click **Generate options** and the AI produces several genuinely different growth options, each with its bet, what must be true, and the strongest argument against. **It does not rank them or recommend one** — that's deliberate.
6. **Choice** — the one thing the AI can't do. You record the decision, the alternatives you considered, your rationale, who decided, and what would make you revisit it.
7. **Coherence** — click **Run checks**. The app flags logic gaps (e.g. a choice that doesn't trace to evidence). Fix them, or accept one with a note (a recorded decision, not an oversight).
8. **Deck** — click **Generate & download deck**. You get an editable PowerPoint (seven slides) you can open and tweak in PowerPoint or Google Slides.

### "Why is this here?"

Anywhere you see an item, you can open it to see its full chain back to the sourced, dated facts underneath. That traceability is the whole point of the app — it works on every client you build.

There's a longer walk-through in `docs/OPERATOR-GUIDE.md` you can share with anyone on your team.

---

## Good to know

- **No login.** Anyone who has the web address can see and edit every client. Only share the link with people you trust. (Adding proper logins is a natural next step if you need it.)
- **The demo client (Meridian).** Safe to explore. Delete it whenever you like — it won't affect your real clients.
- **The deck's look.** The generated slides currently use a neutral placeholder theme, clearly labelled. When you provide your firm's PowerPoint template, the same slides can be re-skinned in your brand — no rework to the app.
- **The AI never decides.** By design, the app's AI can draft options but is technically prevented from recording a choice or a decision. Choices are always human-made. This is enforced deep in the database, not just asked politely.

---

## For a technical helper (optional)

Deeper design notes live in:
- `CLAUDE.md` — scope and architecture.
- `docs/adr/` — the "why" behind key decisions (see `0009` for the multi-client + handover design).
- `docs/graph-queries.md` — how the deck reads from the data.
- `supabase/migrations/` — the database definition (the five files above).
