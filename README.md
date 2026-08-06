# Strategy Journey Platform — Consultant Workspace

A web app for building client strategies where **every conclusion can be traced back to evidence**. You capture sourced facts, turn them into insights, assess the client's capabilities, let the app draft a SWOT and a set of growth options, record the human decision, and generate an editable PowerPoint deck — and at any point you can click any item and ask *"why is this here?"* and see the chain back to the dated, sourced facts it rests on.

You can run it for as many clients as you like. Each client is kept completely separate.

---

## The big picture (how it fits together)

The app has three moving parts. You don't need to understand the internals — just know what each one is and that you own it:

| Part | What it is | Who provides it |
|---|---|---|
| **The website** | What you and your team open in a browser. Hosted on **Netlify**. | You set it up once (below). |
| **The database** | Where all your clients' data lives. Hosted on **Supabase** (free to start). | You set it up once (below). |
| **The AI** | Drafts the SWOT and the growth options. Uses **Anthropic (Claude)**. | Your own Anthropic API key. |

All three are **your own accounts with your own keys**. Nothing runs on the previous developer's accounts.

---

## Part A — One-time setup (about 30 minutes)

You'll create three free accounts, build the database, put the site online, and you're done. Follow it in order.

### Step 1 — Create the database (Supabase)

1. Go to **[supabase.com](https://supabase.com)** and sign up (free).
2. Click **New project**. Give it a name (e.g. "Strategy Journey"), choose a strong database password (save it somewhere safe), pick the region closest to you, and create it. Wait ~2 minutes for it to finish setting up.
3. In the left menu, open the **SQL Editor**.
4. Now you'll build the database by pasting in five setup files **in order**. They live in this project in the `supabase/migrations` folder. For each file below, open it, copy **all** of its contents, paste into a new SQL Editor query, and click **Run**. Do them in this exact order:
   1. `0001_prototype_schema.sql`
   2. `0002_human_access_and_intake.sql`
   3. `0003_swot_apply.sql`
   4. `0004_options_and_choice.sql`
   5. `0005_multi_client.sql`
   Each should finish with "Success". If one reports an error, stop and check you ran the previous ones first.
5. **Load the demo client** (optional but recommended): open `supabase/seed.sql`, copy all of it, paste into the SQL Editor, and **Run**. This adds "Meridian Logistics", a fully worked example you can explore or delete later.
6. Get your two connection values: in the left menu go to **Project Settings → API**. Copy:
   - the **Project URL** (looks like `https://abcd....supabase.co`)
   - the **anon public** key (a long string). This is the one labelled "anon"/"public" — safe to use in the website.

Keep those two values handy for Step 3.

### Step 2 — Get an AI key (Anthropic)

1. Go to **[console.anthropic.com](https://console.anthropic.com)** and sign up.
2. Add a payment method and a small amount of credit (the app uses Claude to draft SWOTs and options — you only pay for what it uses, typically a few cents per draft).
3. Create an **API key** and copy it (starts with `sk-ant-...`). You'll paste it in Step 3.

> Keep this key private. If it's ever exposed, delete it in the console and create a new one — the app keeps working once you update the key in Netlify.

### Step 3 — Put the site online (Netlify)

1. Go to **[netlify.com](https://netlify.com)** and sign up (free).
2. Make sure this project's code is in a **GitHub repository** you own (if the developer handed you a GitHub repo, you already have this).
3. In Netlify click **Add new site → Import an existing project**, connect GitHub, and pick the repository. Netlify detects Next.js automatically — leave the build settings as they are and don't deploy yet.
4. Before deploying, open **Site settings → Environment variables** and add these three (names must match exactly):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL from Step 1.6 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon public key from Step 1.6 |
   | `ANTHROPIC_API_KEY` | the `sk-ant-...` key from Step 2 |

5. Click **Deploy**. After a couple of minutes you'll get a web address (like `your-site.netlify.app`). Open it — you'll see the **Clients** screen. If you loaded the demo in Step 1.5, "Meridian Logistics" is there.

That's it. Bookmark the address. To change any key later, update it in Netlify's Environment variables and redeploy.

> **Prefer to run it on your own computer instead of hosting it?** It's possible (install [Node.js](https://nodejs.org), copy `.env.example` to `.env.local` and fill in the same three values, then run `npm install` and `npm run dev`, and open `http://localhost:3000`) — but the Netlify route above is simpler and lets your whole team use one link.

---

## Part B — How to use the app

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

1. **Signals** — the sourced facts. Each one needs a source (a web link *or* an interview reference like "CFO, on this date") and a date. This is the foundation; you cannot save a fact without saying where it came from.
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
- **Your keys are yours.** Everything runs on your Supabase, Netlify, and Anthropic accounts. Rotate any key anytime by updating it in Netlify.

---

## For a technical helper (optional)

If you have a developer assisting, the deeper design notes live in:
- `CLAUDE.md` — scope and architecture.
- `docs/adr/` — the "why" behind key decisions.
- `docs/graph-queries.md` — how the deck reads from the data.
- `supabase/migrations/` — the database definition (the five files above).

They can also run the database with the Supabase CLI (`supabase db reset` applies all migrations + seed) instead of pasting files by hand.
