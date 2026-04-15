# NutriTrack

A full-stack nutrition tracker for logging meals, managing custom ingredients, and monitoring calorie and macro intake over time.

NutriTrack is built as a React single-page app served by an Express API, with Supabase Authentication and PostgreSQL for persistent user data. The project is configured to deploy as a single Render Web Service.

## Features

- Google sign-in with Supabase Auth
- User-specific nutrition data stored in PostgreSQL
- Ingredient library with per-100g and per-serving nutrition values
- Daily meal logging with calorie, protein, carb, and fat totals
- Reusable meal templates
- Date-based meal navigation
- 7-day nutrition statistics with charts
- Profile-based daily calorie target calculation
- Light and dark theme support
- Progressive Web App metadata and service worker
- Single-service production deployment for frontend and backend

## Tech Stack

**Frontend**

- React
- Vite
- React Router
- Recharts
- CSS Modules
- Lucide React

**Backend**

- Node.js
- Express
- PostgreSQL
- Supabase Auth
- `pg`

**Deployment**

- Render Web Service
- Render Blueprint support via `render.yaml`

## Project Structure

```text
.
├── src/                  # React frontend
│   ├── components/       # UI, auth, meals, ingredients, charts
│   ├── context/          # Auth context
│   ├── hooks/            # API-backed data hooks
│   ├── lib/              # Supabase and API helpers
│   ├── pages/            # App routes
│   └── utils/            # Date and nutrition helpers
├── server/               # Express backend
│   ├── auth.js           # Supabase token verification middleware
│   ├── db.js             # PostgreSQL connection and schema setup
│   ├── index.js          # API routes and frontend serving
│   └── package.json
├── public/               # Static assets
├── render.yaml           # Render Blueprint config
├── package.json          # Frontend scripts and production entry commands
└── vite.config.js
```

## Requirements

- Node.js 20 or newer. Node 22 is recommended.
- npm
- Supabase project
- PostgreSQL connection string

If you use `nvm`, the project includes an `.nvmrc`:

```sh
nvm use
```

## Environment Variables

Create a root `.env` file for the Vite frontend:

```sh
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Create `server/.env` for the backend:

```sh
DATABASE_URL=your_postgres_connection_string
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=5173
```

`PORT=5173` is useful for local development. Do not set `PORT` manually on Render; Render provides it automatically.

## Local Development

Install frontend dependencies:

```sh
npm install
```

Install backend dependencies:

```sh
npm install --prefix server
```

Run the full app from one local Express server:

```sh
npm run dev:full
```

Open:

```text
http://localhost:5173
```

In development, Express mounts Vite as middleware, so the frontend and backend run from the same local origin.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Runs the Vite frontend only |
| `npm run dev:full` | Runs Express with Vite middleware for local full-stack development |
| `npm run build` | Builds the frontend into `dist/` |
| `npm run lint` | Runs ESLint |
| `npm run render-build` | Installs frontend/backend dependencies and builds the frontend |
| `npm start` | Starts the production Express server |

## Production Build

Build the frontend and prepare the backend:

```sh
npm run render-build
```

Start the production server:

```sh
npm start
```

In production, Express serves:

- API routes under `/api`
- the compiled frontend from `dist/`
- React Router fallback routes through `dist/index.html`

## Deploying to Render

This repository is designed to run as a single Render Web Service.

### Option 1: Render Blueprint

The repository includes `render.yaml`. In Render:

1. Create a new Blueprint.
2. Connect this GitHub repository.
3. Render will read `render.yaml`.
4. Add the required secret environment variables when prompted.

### Option 2: Manual Web Service

Create a new Render Web Service and use:

```sh
Build Command: npm run render-build
Start Command: npm start
```

Set these environment variables in Render:

```sh
NODE_VERSION=22
DATABASE_URL=your_postgres_connection_string
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Do not set `PORT` in Render.
Do not set `NODE_ENV` manually for the build; `npm start` sets `NODE_ENV=production` when the server starts.

## Supabase Auth Configuration

After Render creates the production URL, update Supabase Auth settings:

1. Go to Supabase Dashboard.
2. Open `Authentication` -> `URL Configuration`.
3. Set `Site URL` to your Render URL.
4. Add your Render URL to the allowed redirect URLs.

Example:

```text
https://your-app-name.onrender.com
```

For local development, also allow:

```text
http://localhost:5173
```

## Database

The Express server initializes the required PostgreSQL tables on startup if they do not already exist:

- `profiles`
- `ingredients`
- `day_entries`
- `meal_templates`

Each API request is authenticated with the Supabase access token and scoped to the current user.

## Security Notes

- Never commit `.env` files.
- Rotate database credentials if they were ever committed or shared publicly.
- Keep Supabase anon keys in environment variables, even though anon keys are designed for client-side use.
- Keep `DATABASE_URL` server-only.

## License

No license has been specified yet. Add a license before accepting external contributions or reuse.
