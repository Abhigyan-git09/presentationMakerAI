# PitchPilot

AI-assisted presentation builder with email authentication, a user-owned presentation
library, contextual Wikimedia Commons photos, and PPTX/PDF export.

## Production architecture

- React and Vite frontend on Vercel
- Supabase Auth for email/password accounts
- Supabase Postgres with Row Level Security for saved presentations
- A protected Vercel Function at `POST /api/generate` for Gemini requests
- Client-side PPTX/PDF generation and Wikimedia Commons photo lookup

The FastAPI/SQLite service in `services/auth-service` is retained as local legacy
reference code. It is not required for the Supabase deployment.

## Local setup

Install dependencies:

```powershell
pnpm install
```

Copy `.env.example` to `.env.local` and add the Supabase project URL, Supabase
publishable key, and a server-only Gemini API key.

Run the full Vercel-compatible application, including `/api/generate`:

```powershell
pnpm dlx vercel dev
```

Run checks:

```powershell
pnpm test
pnpm run build
```

## Vercel deployment

Import the repository as a Vite project, leave the root directory unchanged, and use:

- Build command: `pnpm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
  `GEMINI_API_KEY`, and `GEMINI_MODEL`

After the first deployment, add the production Vercel URL to Supabase Authentication
URL Configuration and redeploy.
