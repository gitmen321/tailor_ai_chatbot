# Deploying the PWA

Use the repository root [`DEPLOY.md`](../DEPLOY.md) as the deployment source of truth. It covers Supabase Edge Functions, Netlify, and both supported Vercel project layouts.

## Vercel environment variables

Set these for each Vercel environment that should build the app (Production, Preview, and optionally Development):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | The Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | The project's publishable key (`sb_publishable_…`) or legacy anon key |
| `VITE_TURNSTILE_SITE_KEY` | Only when Auth CAPTCHA is enabled |

Leave `VITE_SERVER_API_URL` unset so the Vercel `/api/*` rewrite is used. Do not add `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, provider keys, or Redis tokens to Vercel's web environment; those are server-side Supabase Edge Function settings.

The repository-root `vercel.json` configures a monorepo-root Vercel project. If you instead set Vercel's Root Directory to `web`, its `web/vercel.json` is configured for that layout. Choose one layout, not both.

After deployment, add the exact Vercel site origin to the Supabase Edge Function `API_ALLOWED_ORIGINS` secret and the Vercel URL to Supabase Auth's redirect URL allowlist where OAuth redirects are used. The root [`DEPLOY.md`](../DEPLOY.md) has the full steps.
