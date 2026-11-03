# Deploy Tailor Assistant (Netlify or Vercel + Supabase Edge Functions)

Host the **web PWA** on [Netlify](https://www.netlify.com/) or [Vercel](https://vercel.com/) and the **API** as a [Supabase Edge Function](https://supabase.com/docs/guides/functions). Both use the same `home_ai_agent` Supabase project.

```
Phone / browser (PWA on Netlify)
        │  HTTPS + Bearer token
        ▼
Supabase Edge Function  functions/v1/api
        │
        ▼
Postgres / pgvector + Gemini + YouTube / Tavily
```

The old Node/Express server on Railway is no longer required for chat, history, transcribe, or TTS.

---

## Before you start

1. Push code to GitHub (`https://github.com/gitmen321/tailor_ai_chatbot`).
2. Use the same `API_AUTH_TOKEN` on the Edge Function secrets and on Netlify (`VITE_API_AUTH_TOKEN`).
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
| `PRIMARY_USER_NAME` | Display name in prompts |
| `YOUTUBE_API_KEY` | Optional |
| `TAVILY_API_KEY` | Optional web search |
| `MACHINE_BRAND` | e.g. `Usha` |
| `MACHINE_MODEL` | e.g. `Quick Stitch Master` |
| `API_AUTH_TOKEN` | Shared with the PWA |
| `API_ALLOWED_ORIGINS` | Comma-separated exact PWA origins, e.g. `https://your-site.netlify.app` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Do not put the service role key in the web app.

JWT verification is off (`supabase/config.toml`) because the PWA uses `API_AUTH_TOKEN`, not a Supabase user JWT.

The shared token is visible in the public PWA bundle and is only a demo gate, not user authentication. See [SECURITY.md](./SECURITY.md) before using this for multiple users or private data.

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
| `VITE_API_AUTH_TOKEN` | **Same** value as `API_AUTH_TOKEN` on the Edge Function |
| `VITE_MACHINE_BRAND` | e.g. `Usha` |
| `VITE_MACHINE_MODEL` | e.g. `Quick Stitch Master` |
| `VITE_SERVER_API_URL` | **Leave unset**. The PWA calls same-origin `/api/*`. |

Trigger a new Netlify deploy after changing Vite env vars.

## Part 3 — Deploy the web PWA on Vercel

The repository includes [`vercel.json`](./vercel.json) for a repository-root Vercel project and [`web/vercel.json`](./web/vercel.json) for a Vercel project whose Root Directory is set to `web`. Either setup installs the PWA dependencies, runs the Vite build, publishes the correct `dist` directory, proxies `/api/*` to the same Supabase Edge Function, and serves the React SPA fallback. Use only one Root Directory setting in Vercel; do not configure both project styles at once.

Set these Vercel environment variables for the **Production**, **Preview**, and **Development** environments as needed:

| Name | Value |
|------|-------|
| `VITE_API_AUTH_TOKEN` | **Same** value as `API_AUTH_TOKEN` on the Edge Function |
| `VITE_MACHINE_BRAND` | e.g. `Usha` |
| `VITE_MACHINE_MODEL` | e.g. `Quick Stitch Master` |
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

WhatsApp (`whatsapp/`) is a persistent Baileys socket. That still needs a long-running process; point `SERVER_API_URL` at `https://vdohxjqzczhmgfuedrwj.supabase.co/functions/v1`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Unauthorized` | `VITE_API_AUTH_TOKEN` on Netlify must match `API_AUTH_TOKEN` secret. Redeploy Netlify after changing. |
| Platform `401` before your code runs | Deploy with `--no-verify-jwt` (already set in `config.toml`). |
| Server offline in the PWA | Open `/api/health` on the Netlify origin, then the function URL above. |
| Chat times out | Edge Functions have a wall-clock limit; check function logs in the Supabase dashboard. |
