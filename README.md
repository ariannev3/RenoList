# Renovate — shared renovation board

A tasks-and-materials tracker organised per room. It runs as a website on your
own URL and saves everything to a shared database, so you and one other person
always see the same, up-to-date board — on a laptop or a phone.

- **Frontend:** React + Vite
- **Database + live sync:** Supabase (free tier)
- **Hosting:** Vercel (free tier)

You'll do this once and end up with a link like `https://reno-board.vercel.app`.

---

## What you need first

- **Node.js 18 or newer** — download from https://nodejs.org (the "LTS" version).
  Check it's installed by running `node -v` in a terminal.
- A **Supabase** account — https://supabase.com (free).
- A **GitHub** account — https://github.com (free).
- A **Vercel** account — https://vercel.com (free; sign in with GitHub).

There are five steps. Take them in order.

---

## Step 1 — Create the database (Supabase)

1. Go to https://supabase.com, sign in, and click **New project**.
2. Give it a name (e.g. `reno-board`), set a database password (save it
   somewhere), pick a region near you, and create it. Wait ~1 minute for it to
   finish setting up.
3. In the left sidebar open **SQL Editor** → **New query**.
4. Open the file `supabase-setup.sql` from this project, copy everything, paste
   it into the editor, and click **Run**. You should see "Success".
5. Now get your two keys. Open **Settings** (gear icon) → **API Keys**.
   - Copy the **Project URL** (looks like `https://abcd1234.supabase.co`).
   - Copy the **Publishable key** (starts with `sb_publishable_`).
     *If your project only shows a legacy "anon public" key, copy that instead —
     it works exactly the same here.*

Keep these two values handy for the next step.

> The publishable/anon key is meant to live in browser code — it's safe to
> expose **because** the security rules (Row Level Security) you just created
> control what it's allowed to do.

---

## Step 2 — Run it on your computer

1. Open a terminal **in this project folder** (the folder containing
   `package.json`).
2. Install the dependencies:
   ```
   npm install
   ```
3. Create your local secrets file. Copy `.env.example` to a new file named
   `.env.local`, then paste in the two values from Step 1:
   ```
   VITE_SUPABASE_URL=https://abcd1234.supabase.co
   VITE_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
   ```
4. Start it:
   ```
   npm run dev
   ```
5. Open the URL it prints (usually http://localhost:5173). You should see the
   board with the "Kitchen / Bathroom / Living room" starter data, and a green
   **Live · shared board** pill in the top-right.

Tick a few boxes. To prove sync works, open the same `localhost` URL in a second
browser tab — changes in one appear in the other within a second.

> If you instead see an "Almost there" setup screen, your `.env.local` isn't
> being read. Make sure the file is named exactly `.env.local`, sits next to
> `package.json`, and **stop and restart** `npm run dev` after creating it.

---

## Step 3 — Put the code on GitHub

1. Create a new **empty** repository on https://github.com/new (no README,
   no `.gitignore` — leave it blank). Name it e.g. `reno-board`.
2. Back in your terminal, in this folder, run these one at a time (replace the
   URL with your repo's URL from GitHub):
   ```
   git init
   git add .
   git commit -m "Renovation board"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/reno-board.git
   git push -u origin main
   ```

Your `.env.local` is deliberately **not** uploaded (it's git-ignored), so your
keys stay private. That's why you add them separately in the next step.

---

## Step 4 — Deploy to a public URL (Vercel)

1. Go to https://vercel.com and sign in **with GitHub**.
2. Click **Add New… → Project**, then **Import** the `reno-board` repository.
3. Vercel auto-detects Vite — you don't need to change the build settings.
4. Before deploying, expand **Environment Variables** and add the same two you
   put in `.env.local`:
   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | your `https://….supabase.co` URL |
   | `VITE_SUPABASE_KEY` | your `sb_publishable_…` key |
5. Click **Deploy**. After a minute you'll get a public link like
   `https://reno-board.vercel.app`. Open it — that's your live board.

Send that link to the person you're sharing with. You're both editing the same
board now.

> Whenever you want to change the app later, edit the code and run
> `git add . && git commit -m "update" && git push`. Vercel redeploys the same
> URL automatically.

---

## Step 5 — Use it on your phone

1. Open your Vercel URL in your phone's browser.
2. Add it to your home screen so it opens like an app:
   - **iPhone (Safari):** Share button → **Add to Home Screen**.
   - **Android (Chrome):** ⋮ menu → **Add to Home screen**.
3. Tap the new icon anytime. It's the same shared board, always in sync.

---

## Access & security (please read)

This build has **no login** — anyone who has your Vercel URL can view and edit
the board. For a private renovation list shared with one person, that's usually
fine: the URL is unguessable and unlisted. But keep these in mind:

- Don't post the URL publicly.
- The data isn't secret-grade; don't store anything sensitive in it.

If you later want real protection, two good options:
- **A shared passphrase** gate on the app (simplest — ask me to add it).
- **Supabase Auth** so each person logs in with email (more setup, proper
  accounts). Ask me and I'll wire it up.

---

## Troubleshooting

- **"Almost there" setup screen in production** → the environment variables
  aren't set on Vercel. Add them (Step 4.4), then redeploy (Vercel → your
  project → Deployments → ⋮ → Redeploy).
- **Pill says "Offline — not saving"** → the app can't reach Supabase. Check the
  URL/key values, and that you ran `supabase-setup.sql` successfully.
- **Changes don't sync between devices** → make sure the realtime line in
  `supabase-setup.sql` ran. You can re-run the whole SQL file safely.
- **`npm` or `git` "command not found"** → install Node.js (includes npm) and
  Git (https://git-scm.com), then reopen the terminal.

---

## Project structure

```
reno-board/
├─ index.html            app shell + mobile meta tags
├─ package.json          dependencies and scripts
├─ vite.config.js        build config
├─ supabase-setup.sql    run once in Supabase to create the table
├─ .env.example          template for your keys
├─ .env.local            your real keys (you create this; never committed)
└─ src/
   ├─ main.jsx           React entry point
   ├─ App.jsx            the whole board UI + Supabase sync
   ├─ supabaseClient.js  connects to your database
   └─ index.css          all styling
```
