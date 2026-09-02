# Dietapp

React nutrition tracker using Supabase Auth and Supabase Postgres from the browser, plus one
authenticated Edge Function for nutrition-label analysis.

## Architecture

- React + Vite frontend
- Supabase Auth with Google OAuth
- Supabase Data API for database reads and writes
- Supabase Edge Function for protected Gemini API calls
- Gemini 3.1 Flash-Lite for nutrition-label image extraction
- PostgreSQL Row Level Security (RLS) for authorization
- Render Static Site for hosting

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
4. Run [`supabase/migrations/202609020001_ingredient_barcodes.sql`](supabase/migrations/202609020001_ingredient_barcodes.sql).
5. Confirm all five tables show RLS enabled:
   - `profiles`
   - `weight_logs`
   - `ingredients`
   - `day_entries`
   - `meal_templates`

The migration preserves rows. It replaces existing policies for these app tables with the access
model documented above, then adds barcode metadata and duplicate protection to ingredients.

Barcode scanning needs HTTPS outside localhost so browsers can grant camera access. Deployed Render
static sites already meet this requirement.

## Gemini nutrition-label scanner

The browser never receives the Gemini API key. Images are resized in the browser and sent through the
authenticated `analyze-nutrition-label` Supabase Edge Function. The image is forwarded to Gemini for
analysis and is not written to the app database.

Create a Gemini API key in Google AI Studio, then configure and deploy the function:

```sh
npx supabase login
npx supabase link --project-ref YOUR_SUPABASE_PROJECT_REF
npx supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
npx supabase functions deploy analyze-nutrition-label
```

Do not add `GEMINI_API_KEY` to `.env`, Render, or any `VITE_*` variable. Gemini free-tier quotas still
apply; when the quota is exhausted, the scanner returns a retryable message instead of saving partial
data.

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

Set only these frontend variables in Render:

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
