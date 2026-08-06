# Strategy Journey Platform — Consultant Workspace

A web app for building client strategies where **every conclusion can be traced back to evidence**. You capture sourced facts, turn them into insights, assess the client's capabilities, let the app draft a SWOT and a set of growth options, record the human decision, and generate an editable PowerPoint deck — and at any point you can click any item and ask *"why is this here?"* and see the chain back to the dated, sourced facts it rests on.

You can run it for as many clients as you like. Each client is kept completely separate.

---

## What it runs on

Three services. You don't need to understand the internals — just know what each is:

| Service | What it does | Cost |
|---|---|---|
| **Netlify** | Hosts the website you open in a browser. | Free plan is enough |
| **Supabase** | Hosts the database where all client data lives. | Free plan is enough |
| **Anthropic (Claude)** | The AI that drafts the SWOT and the growth options. | Pay per use (cents per draft) |

---

## Part A — Handover (recommended)

The app is **already built and running**. You'll do two things once, together with whoever is handing it over:

1. **Take ownership of the database** (Supabase) — this transfers for free and keeps **all** the data.
2. **Put the website online on your own Netlify account** from the project's code — because Netlify's *site transfer* needs a paid plan, but **deploying it yourself is free**.

Nothing is lost: the database keeps everything; the website is simply re-hosted from the same code. It takes about 30 minutes.

> **Terminology:** "the outgoing owner" is whoever currently runs the app (the consultant handing it over); **"you"** is the person receiving it.

### Step 1 — Create your accounts and get the code

- **Supabase:** sign up at **[supabase.com](https://supabase.com)** and create **one new, empty organization** (e.g. "My Company").
- **Netlify:** sign up at **[netlify.com](https://netlify.com)** — the free plan is fine.
- **Anthropic:** at **[console.anthropic.com](https://console.anthropic.com)**, add a little credit and create an **API key** (starts with `sk-ant-...`). Keep it handy.
- **The code:** on the project's page on GitHub, click the green **Code** button → **Download ZIP**, and unzip it to a folder on your computer (e.g. on your Desktop). You now have the whole project locally — **you don't need a GitHub account**.

### Step 2 — Take over the database (Supabase transfer)

1. In your new Supabase organization → **Organization settings → Team → Invite**, and invite the outgoing owner by email (role: Owner or Administrator). They accept.
2. The outgoing owner opens the project → **Project Settings → General → Transfer project** → chooses **your** organization → confirms.
3. The database — all its data, its web address, **and its keys** — is now yours, unchanged.
4. Copy the two values you'll need for the website: **Project Settings → API** → the **Project URL** and the **anon public** key.
5. Once it's done, you can remove the outgoing owner from your organization (same Team screen).

### Step 3 — Put the website online (drag and drop — no terminal)

Netlify can build and host the app straight from the project folder. As long as you're **logged in** to Netlify, it recognises this is a Next.js app and does the build for you — no terminal, no Node.js.

1. If you downloaded the code as a **ZIP, unzip it** so you have a normal folder. (It contains files like `package.json` and `netlify.toml`. Drag the *folder*, not the raw `.zip`.)
2. Go to **[app.netlify.com/drop](https://app.netlify.com/drop)** and make sure you're **logged in**.
3. **Drag the project folder** onto the drop area. Netlify detects Next.js, builds it, and gives you a web address. (The database and AI features won't work yet — you add the keys in the next step.)
4. Open your new site → **Project configuration → Environment variables** and add these three:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from Step 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon public key from Step 2 |
   | `ANTHROPIC_API_KEY` | your `sk-ant-...` key from Step 1 |

5. Re-publish so the keys take effect: go to the site's **Deploys** page and **drag the same project folder onto the dropzone at the bottom** (or click **Trigger deploy → Deploy site**).
6. Open the web address. You'll see the **Clients** screen with the demo client "Meridian Logistics". Bookmark it and share it with your team.

### Deploying code changes later (no terminal, no GitHub)

**Day-to-day use needs no redeploying** — your clients, signals, and strategies are saved live in the database the moment you enter them. You only redeploy when the **app's code** changes: a new feature, a fix, or dropping in your firm's branded slide theme.

To publish a code change: put the updated files in the project folder, then on Netlify go to your site's **Deploys** page and **drag the folder onto the dropzone at the bottom**. Netlify rebuilds and publishes to the **same web address**. No terminal, no GitHub.

> **Want automatic updates?** If you (or a developer) later put the project in a free GitHub account and connect it to Netlify once, every change publishes by itself when saved. The drag-and-drop above works without it.

---

## Part B — Alternative: build a fresh copy from scratch

You only need this if you want a brand-new, independent copy with an **empty** database (e.g. a second environment), rather than taking over the existing one.

1. **Database (Supabase):** create a project. Open the **SQL Editor** and run these five files from `supabase/migrations/`, **in order**, pasting each one's full contents and clicking Run: `0001_prototype_schema.sql`, `0002_human_access_and_intake.sql`, `0003_swot_apply.sql`, `0004_options_and_choice.sql`, `0005_multi_client.sql`. To load the demo client, also run `supabase/seed.sql`. Then from **Project Settings → API** copy the **Project URL** and the **anon public** key.
2. **AI key (Anthropic):** create an API key at [console.anthropic.com](https://console.anthropic.com).
3. **Website (Netlify):** deploy exactly as in **Part A, Step 3** (the drag-and-drop method), using this project's URL and keys.

(A developer with the Supabase CLI can do the database step in one command: `supabase db reset` applies all migrations plus the seed.)

> **Prefer to run it on your own computer instead of hosting it?** Install [Node.js](https://nodejs.org), copy `.env.example` to `.env.local` and fill in the three values, then run `npm install` and `npm run dev`, and open `http://localhost:3000`.

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
- **Your keys.** After handover the Supabase keys are yours (you own the project) and the Anthropic key is the one you set during deploy. Rotate any of them anytime in **Environment variables**, then re-publish (drag the folder onto the Deploys dropzone, or **Trigger deploy**).

---

## For a technical helper (optional)

Deeper design notes live in:
- `CLAUDE.md` — scope and architecture.
- `docs/adr/` — the "why" behind key decisions (see `0009` for the multi-client + handover design).
- `docs/graph-queries.md` — how the deck reads from the data.
- `supabase/migrations/` — the database definition (the five files above).
