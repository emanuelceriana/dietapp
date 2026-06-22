# Dietapp

React nutrition tracker using Supabase Auth and Supabase Postgres directly from the browser.
No application server is required.

## Architecture

- React + Vite frontend
- Supabase Auth with Google OAuth
- Supabase Data API for database reads and writes
- PostgreSQL Row Level Security (RLS) for authorization
- Render Static Site for hosting

The old `server/` directory remains temporarily as rollback/reference code, but production and
local development no longer use it.

## Access model

- Profiles, weights, daily entries, and templates are private to their owner.
- Authenticated users can read public ingredients.
- Every user can create ingredients.
- Only an ingredient owner can update or delete it.
- Private ingredients are visible only to their owner.

## Local development

Create `.env`:

```sh
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Install and run:

```sh
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## Database migration

Before using the frontend-only build:

1. Open Supabase Dashboard.
2. Open **SQL Editor**.
3. Run [`supabase/migrations/202606220001_frontend_rls.sql`](supabase/migrations/202606220001_frontend_rls.sql).
4. Confirm all five tables show RLS enabled:
   - `profiles`
   - `weight_logs`
   - `ingredients`
   - `day_entries`
   - `meal_templates`

The migration preserves rows. It replaces existing policies for these app tables with the access
model documented above.

## Validation

```sh
npm run build
npm run lint
```

`npm run build` creates `dist/`.

## Render deployment

`render.yaml` now defines a free static site:

```text
Build Command: npm install && npm run build
Publish Directory: dist
```

Set only:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

An existing Node Web Service cannot be converted in place to a Static Site. Create/sync the new
`dietapp-static` service, test it, then delete the old Node service.

After Render assigns the new URL:

1. Open Supabase **Authentication → URL Configuration**.
2. Add `https://<new-site>.onrender.com/**` to allowed redirect URLs.
3. After testing login, set it as the Site URL.
4. Keep `http://localhost:5173/**` allowed for local development.

Do not expose `DATABASE_URL` or a Supabase service-role key in frontend environment variables.
