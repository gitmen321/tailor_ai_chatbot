# Deploy Tailor Assistant (Netlify + Railway)

Host the **web PWA** on [Netlify](https://www.netlify.com/) and the **Node API** on [Railway](https://railway.app/). Both connect to the same Supabase project you use locally.

```
Phone / browser (PWA on Netlify)
        │  HTTPS + Bearer token
        ▼
Railway API (server/)
        │
        ▼
Supabase + Gemini + YouTube / Tavily
```

---

## Before you start

1. **Push code to GitHub** — Netlify and Railway deploy from `https://github.com/gitmen321/tailor_ai_chatbot`.
2. **Generate an API token** (use the same value on server and web):

   ```powershell
   # PowerShell — copy the output
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
   ```

3. **Optional 3D model** — copy your sewing-machine GLB to `web/public/models/machine.glb` before building (large file is gitignored). The app works without it (shows a silhouette).

---

## Part 1 — Deploy the server on Railway

### 1. Create the project

1. Log in at [railway.app](https://railway.app/).
2. **New Project → Deploy from GitHub repo** → select `gitmen321/tailor_ai_chatbot`.
3. Open the new service → **Settings**:
   - **Root Directory**: `server`
   - **Start Command**: `npm start` (also set in `server/railway.toml`)
4. **Settings → Networking → Generate Domain** — copy the URL, e.g. `https://tailor-assistant-production.up.railway.app` (no trailing slash).

### 2. Environment variables

In Railway → your service → **Variables**, add everything from `server/.env.example`:

| Variable | Notes |
|----------|--------|
| `GOOGLE_API_KEY` | Gemini chat, TTS, embeddings |
| `GEMINI_CHAT_MODEL` | e.g. `gemini-3.5-flash` |
| `GEMINI_TTS_MODEL` | e.g. `gemini-3.1-flash-tts-preview` |
| `GEMINI_TTS_VOICE` | e.g. `Kore` |
| `PRIMARY_USER_NAME` | Display name in prompts |
| `SUPABASE_URL` | From Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role** key (server only — never put in the web app) |
| `YOUTUBE_API_KEY` | Optional; enables YouTube Data API search |
| `TAVILY_API_KEY` | Optional web search |
| `MACHINE_BRAND` | e.g. `Usha` |
| `MACHINE_MODEL` | e.g. `Quick Stitch Master` |
| `API_AUTH_TOKEN` | The secret token you generated above |

Railway sets `PORT` automatically — do not override it.

**Node.js 22+** is required (Supabase client needs native WebSocket or the bundled `ws` transport). This repo pins Node 22 via `server/package.json` engines, `server/.nvmrc`, and `server/nixpacks.toml`.

### 3. Verify the API

After deploy finishes, open:

```
https://YOUR-RAILWAY-DOMAIN.up.railway.app/api/health
```

You should see: `{"ok":true}`

---

## Part 2 — Deploy the web PWA on Netlify

The app is already a PWA (`vite-plugin-pwa`: manifest, service worker, install prompts, offline app shell).

### 1. Connect the repo

1. Log in at [app.netlify.com](https://app.netlify.com/).
2. **Add new site → Import an existing project** → GitHub → `gitmen321/tailor_ai_chatbot`.

### 2. Build settings (monorepo)

| Setting | Value |
|---------|--------|
| Base directory | `web` |
| Build command | `npm run build` |
| Publish directory | `dist` |

`web/netlify.toml` already configures SPA redirects, manifest MIME type, and service-worker cache headers.

### 3. Environment variables (build time)

**Site settings → Environment variables** — Vite bakes these in at build time; change them and **trigger a new deploy** after updating.

| Name | Value |
|------|--------|
| `VITE_SERVER_API_URL` | Your Railway URL, e.g. `https://tailor-assistant-production.up.railway.app` |
| `VITE_API_AUTH_TOKEN` | **Same** value as `API_AUTH_TOKEN` on Railway |
| `VITE_MACHINE_BRAND` | e.g. `Usha` |
| `VITE_MACHINE_MODEL` | e.g. `Quick Stitch Master` |

### 4. Deploy

Click **Deploy site**. When the build succeeds, Netlify gives you a URL like `https://random-name.netlify.app`.

Optional: **Domain management** → add a custom domain.

---

## Part 3 — Test the live PWA

1. Open the Netlify URL on your phone (Chrome / Safari).
2. **Android / desktop Chrome**: use the install banner or browser menu → **Install app**.
3. **iPhone Safari**: Share → **Add to Home Screen** (the app shows a Malayalam hint).
4. In the app, send a chat message — it should hit Railway → Supabase/Gemini.

### Confirm PWA in Chrome DevTools

1. Open the Netlify site → F12 → **Application** tab.
2. **Manifest** — name, icons, `display: standalone`.
3. **Service workers** — `sw.js` registered and activated.

---

## Order of operations (recommended)

1. Deploy **Railway** first → copy the public API URL.
2. Set Netlify env vars with that URL + shared auth token.
3. Deploy **Netlify**.
4. Test health endpoint, then chat from the PWA.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Unauthorized` in chat | `VITE_API_AUTH_TOKEN` on Netlify must match `API_AUTH_TOKEN` on Railway. Redeploy Netlify after changing. |
| `VITE_SERVER_API_URL is not set` | Add the env var on Netlify and redeploy (vars are embedded at build time). |
| CORS errors | Server already allows browser origins (`cors({ origin: true })`). Check the API URL is HTTPS and correct. |
| PWA won’t install | Site must be served over HTTPS (Netlify does this). Manifest and SW must load — check DevTools → Application. |
| Chat times out | Railway free tier can cold-start; retry after ~30s. Check Railway logs for Gemini/Supabase errors. |
| No 3D machine model | Add `web/public/models/machine.glb` locally, commit or use Netlify build plugin / large-file hosting, then rebuild. |

---

## Local development vs production

| | Local | Production |
|---|--------|------------|
| Web | `cd web && npm run dev` | Netlify |
| API | `cd server && npm run dev` | Railway |
| `VITE_SERVER_API_URL` | `http://127.0.0.1:3000` in `web/.env` | Railway HTTPS URL on Netlify |

The phone PWA **cannot** call `localhost` on your laptop — it must use the public Railway URL.
