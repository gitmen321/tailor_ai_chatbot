# Deploy Tailor Assistant (Netlify or Vercel + Supabase Edge Functions)

Host the **web PWA** on [Netlify](https://www.netlify.com/) or [Vercel](https://vercel.com/) and the **API** as a [Supabase Edge Function](https://supabase.com/docs/guides/functions). Both use the same `home_ai_agent` Supabase project.

```
Phone / browser (PWA)
        │  Supabase Auth access token
        ▼
Vercel / Netlify API rewrite → Supabase Edge API
        │  Verify Auth · shared Redis limits
        ▼
Controllers → Use cases → Repositories / provider adapters
        │                         │
        ▼                         ▼
Postgres / pgvector          Gemini / search / speech
```

The old Node/Express server on Railway is no longer required for chat, history, transcribe, or TTS.

---

## Before you start

1. Push code to GitHub (`https://github.com/gitmen321/tailor_ai_chatbot`).
2. Configure Supabase Auth, Upstash Redis, and PWA public Auth settings as described below. Never expose server-only keys through a `VITE_*` variable.
3. Optional 3D model — copy your sewing-machine GLB to `web/public/models/machine.glb` before building.

---

## Part 1 — Deploy the API as a Supabase Edge Function

Do this from the repo root with the [Supabase CLI](https://supabase.com/docs/guides/cli).

```powershell
npx supabase login
npx supabase link --project-ref vdohxjqzczhmgfuedrwj
```

Set secrets (copy from `server/.env` into `supabase/.env`, then):

```powershell
npx supabase secrets set --env-file supabase/.env
```

Required secrets:

| Variable | Notes |
|----------|--------|
| `GOOGLE_API_KEY` | Gemini chat, TTS, embeddings |
| `GEMINI_CHAT_MODEL` | e.g. `gemini-3.5-flash` |
| `GEMINI_TTS_MODEL` | e.g. `gemini-3.1-flash-tts-preview` |
| `GEMINI_TTS_VOICE` | e.g. `Kore` |
| `PRIMARY_USER_NAME` | Legacy WhatsApp prompt fallback only |
| `YOUTUBE_API_KEY` | Optional |
| `TAVILY_API_KEY` | Optional web search |
| `MACHINE_BRAND` | e.g. `Usha` |
| `MACHINE_MODEL` | e.g. `Quick Stitch Master` |
| `WHATSAPP_API_AUTH_TOKEN` | Fresh, server-only secret matching the WhatsApp service credential; rotate the old shared browser token |
| `UPSTASH_REDIS_REST_URL` | Shared, durable API rate-limit store |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only Upstash REST token |
| `CHAT_RATE_LIMIT_PER_MINUTE` | Default `10` per account |
| `CHAT_USER_DAILY_LIMIT` | Default `100` per account per rolling 24 hours |
| `CHAT_GLOBAL_DAILY_LIMIT` | Default `1000` chat requests per rolling 24 hours |
| `MEDIA_RATE_LIMIT_PER_MINUTE` | Default `20` per account |
| `MEDIA_USER_DAILY_LIMIT` | Default `50` per account per rolling 24 hours |
| `MEDIA_GLOBAL_DAILY_LIMIT` | Default `2000` media requests per rolling 24 hours |
| `API_IP_RATE_LIMIT_PER_MINUTE` | Default `60` per source IP |
| `API_ALLOWED_ORIGINS` | Comma-separated exact PWA origins, e.g. `https://your-site.netlify.app` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Do not put the service role key in the web app. Paid API routes return `503` until the Upstash REST URL and token are set.

Gateway JWT verification remains off so `/health` can stay public; protected routes validate Supabase Auth tokens in the Edge API. The shared `WHATSAPP_API_AUTH_TOKEN` is accepted only for the legacy WhatsApp chat path, not PWA profile/history/media routes.

Before applying the migration, confirm the correct owner for any legacy profile that should move to an Auth account. Legacy rows remain unassigned until that mapping is verified. The migration has not been applied to production from this checkout.

### Required Supabase dashboard setup

1. Under **Authentication → Providers**, enable Email. For the no-SMTP demo, turn **Confirm email** off. New email/password accounts will receive a session immediately. Email verification and password-reset email are therefore unavailable until you configure email delivery.
2. To enable Google demo sign-in, create an OAuth **Web application** client in Google Cloud. Set its consent screen audience to **External / Testing**, add the demo Google accounts as test users, set the authorized JavaScript origin to the PWA origin, and set the authorized redirect URI to the callback URL shown on the Supabase Google provider page. Enable Google in **Authentication → Providers → Google** and enter the client ID/secret there. Add the PWA URLs to Supabase **URL Configuration → Redirect URLs**. Google Testing mode allows up to 100 allowlisted testers; it is not an unrestricted public Google login.
3. Configure Auth rate limits under **Authentication → Rate Limits**. Enable Cloudflare Turnstile in Auth bot protection, add its **secret key** in Supabase and the matching **site key** as `VITE_TURNSTILE_SITE_KEY` in each PWA build environment. The PWA sends CAPTCHA tokens on email/password sign-up and sign-in.
4. Provision an Upstash Redis database and set its REST URL/token as Edge Function secrets. Keep the credentials out of the PWA and WhatsApp configuration.
5. Before applying `20261118175150_multi_user_accounts_and_rls.sql`, recheck that `conversations.user_id` has no duplicate rows. Then review the RLS policies, FK cascade behavior, learned-answer owner filter, and profile migration. Apply it before deploying the new Edge Function.
6. If the original user’s old chat should carry over, create that user’s Auth account, positively identify their `public.users.id`, then assign only that row’s `auth_user_id` with an operator-only SQL update. Do not expose a public self-claim endpoint.

### Later: custom email delivery and public OAuth

The demo does not need SMTP or a custom domain for email/password accounts. When you are ready to verify emails, offer email password recovery, or restore magic-link sign-in, acquire a domain and configure its sender DNS records with an SMTP provider; then configure the provider under Supabase **Authentication → SMTP Settings**, verify delivery, and turn **Confirm email** back on. Do not enable confirmation until delivery has been tested.

For Google sign-in beyond the demo allowlist, publish the Google OAuth app and complete Google's production branding/domain verification as applicable. Google requires a verified domain for the app's production homepage and related OAuth domains. See [Google OAuth production policies](https://developers.google.com/identity/verification/authentication-policy-compliance).

Deploy:

```powershell
npx supabase functions deploy api --no-verify-jwt
```

Health check:

```
https://vdohxjqzczhmgfuedrwj.supabase.co/functions/v1/api/health
```

You should see JSON with `"ok": true` and `"runtime": "supabase-edge"`.

---

## Part 2 — Deploy the web PWA on Netlify

### 1. Connect the repo

1. Log in at [app.netlify.com](https://app.netlify.com/).
2. **Add new site → Import an existing project** → GitHub → `gitmen321/tailor_ai_chatbot`.

### 2. Build settings (monorepo)

| Setting | Value |
|---------|--------|
| Base directory | `web` |
| Build command | `npm run build` |
| Publish directory | `dist` |

`web/netlify.toml` proxies `/api/*` to the Edge Function:

`https://vdohxjqzczhmgfuedrwj.supabase.co/functions/v1/api/:splat`

### 3. Environment variables (build time)

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key only; never a service-role key |
| `VITE_TURNSTILE_SITE_KEY` | CAPTCHA site key when Auth CAPTCHA is enabled |
| `VITE_SERVER_API_URL` | **Leave unset**. The PWA calls same-origin `/api/*`. |

Trigger a new Netlify deploy after changing Vite env vars.

## Part 3 — Deploy the web PWA on Vercel

The repository includes [`vercel.json`](./vercel.json) for a repository-root Vercel project and [`web/vercel.json`](./web/vercel.json) for a Vercel project whose Root Directory is set to `web`. Either setup installs the PWA dependencies, runs the Vite build, publishes the correct `dist` directory, proxies `/api/*` to the same Supabase Edge Function, and serves the React SPA fallback. Use only one Root Directory setting in Vercel; do not configure both project styles at once.

Set these Vercel environment variables for the **Production**, **Preview**, and **Development** environments as needed:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable/anon key only; never a service-role key |
| `VITE_TURNSTILE_SITE_KEY` | CAPTCHA site key when Auth CAPTCHA is enabled |
| `VITE_SERVER_API_URL` | Leave unset; Vercel serves the `/api/*` rewrite |

After the first Vercel deployment, add the exact Vercel production URL to the Edge Function's comma-separated `API_ALLOWED_ORIGINS` secret, then redeploy the function. Add any custom domain origins there as well. Keep `web/netlify.toml` if you also want Netlify deployments.

The 3D model uses Meshopt WebAssembly decoding. The included Vercel and Netlify CSP headers contain `wasm-unsafe-eval`; keep that directive if you customize the security headers or the optimized model will fall back to the primitive silhouette.

---

## Local development

```powershell
# API (Deno)
deno run --allow-net --allow-env --env-file=server/.env --port=8787 supabase/functions/api/index.ts
# or: $env:PORT=8787; deno run --allow-net --allow-env --env-file=server/.env supabase/functions/api/index.ts

# PWA
cd web
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8787`.

`server/` is still useful as a Node CLI for `npm run ingest` (embedding the machine manual). You do not need to host Express.

WhatsApp (`whatsapp/`) remains a separate persistent Baileys process with no PWA account linking. If you continue running it, set its `API_AUTH_TOKEN` to the same newly rotated value as the Edge Function’s `WHATSAPP_API_AUTH_TOKEN`; keep that credential server-side only. This compatibility path accepts chat requests only.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Unauthorized` | Check the Supabase Auth session and allowed email redirect URLs. |
| `503` with `rate_limiter_unavailable` | Set the Upstash REST URL/token on the Edge Function and redeploy it. |
| `429` | A configured per-user, per-IP, or global rolling-window limit was reached. |
| CAPTCHA or password-auth failure | Check the Auth provider, Confirm email demo setting, rate limits, CAPTCHA provider/secret, and matching PWA Turnstile site key. |
| Google sign-in failure | Check the Google client ID/secret in Supabase Auth, the Supabase callback URI in Google Cloud, the PWA origin, and the tester allowlist while the Google app is in Testing mode. |
| Platform `401` before your code runs | Keep `verify_jwt = false`; the API validates protected user tokens itself and health stays public. |
| Server offline in the PWA | Open `/api/health` on the Netlify origin, then the function URL above. |
| Chat times out | Edge Functions have a wall-clock limit; check function logs in the Supabase dashboard. |
