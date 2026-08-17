# Check My Calendar

A dead-simple **"when to meet"** group scheduler (like when2meet). Make an event,
get a shareable link, everyone marks their free 30-minute slots, and the page shows
the best times to meet a few different ways.

- **No accounts.** Name-only "login": the first time you type a name in an event it's
  claimed; next time the same name picks up your selections. Low security — just to
  keep everyone honest.
- **Shareable URL** per event (`/e/<id>`).
- **Admin** = whoever created the event. Admins can add/remove days and edit the
  **core time windows** shown (e.g. weekdays 5pm–midnight, weekends 11am–midnight).
- **Best times** shown three ways: a heatmap grid, a ranked "top times" list, and a
  "best block" summary (with an *everyone can make it* callout).

## Stack

- **Frontend:** plain HTML/CSS/JS in `public/` — no build step.
- **API:** Vercel serverless functions in `api/`.
- **DB:** Supabase Postgres (free tier), reached via `@supabase/supabase-js` using the
  service-role key kept server-side. (Vercel Postgres / Neon work too — both are plain
  Postgres; just point the env vars at them.)

### Do we need a DB?

Yes — selections are shared across people through one URL and must survive restarts, so
storage has to be server-side. But nothing heavy: Vercel's serverless filesystem is
ephemeral (a SQLite/JSON file wouldn't persist), so a free hosted Postgres is the fit.

## Setup

1. **Create a Supabase project** (free) at supabase.com.
2. In the Supabase **SQL Editor**, paste and run [`schema.sql`](./schema.sql).
3. In Supabase **Project Settings → API**, copy the **Project URL** and the
   **service_role** key.
4. Set env vars (see [`.env.example`](./.env.example)):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`  ← service_role key, server-side only.

## Run locally

```bash
npm install
cp .env.example .env      # fill in your Supabase values
npx vercel dev            # serves the static site + /api functions
```

Open http://localhost:3000, create an event, and share the `/e/<id>` link.

## Deploy (Vercel)

1. Import this repo in Vercel (it auto-detects the static site + `api/` functions).
2. Add the two environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`) in
   **Project → Settings → Environment Variables**.
3. Deploy. Every event lives at `https://<your-app>.vercel.app/e/<id>`.

## Data model

| table          | purpose                                                        |
| -------------- | ------------------------------------------------------------- |
| `events`       | one row per event: title, admin name, core time windows       |
| `event_days`   | the dates an event covers                                     |
| `participants` | one row per name per event (case-insensitive)                 |
| `availability` | one row per selected 30-minute chunk `(participant, day, min)` |

Times are stored as **minutes from midnight** (0–1440, step 30). Only *selected*
chunks are stored; narrowing a core window just hides out-of-range picks (kept in the
DB, reversible).

## Notes

- All writes go through the API with the service-role key, so Row Level Security is
  intentionally off. Don't expose the anon key with write access from the browser.
- Collaborators' changes show up via a light 5-second poll (no websockets).
