# Deploying the Tailor Assistant web PWA to Netlify

This app lives in the monorepo under `web/`.

## 1. Connect the repo

1. Log in to [Netlify](https://app.netlify.com/).
2. **Add new site → Import an existing project** and select the GitHub repo `gitmen321/tailor_ai_chatbot`.

## 2. Build settings (monorepo)

In site settings / build & deploy:

| Setting | Value |
|---------|--------|
| Base directory | `web` |
| Build command | `npm run build` |
| Publish directory | `web/dist` (or `dist` if base is already `web`) |

`web/netlify.toml` already sets `command = "npm run build"` and `publish = "dist"` relative to the base directory.

## 3. Environment variables

In **Site settings → Environment variables**, add:

| Name | Value |
|------|--------|
| `VITE_API_AUTH_TOKEN` | Same token as `API_AUTH_TOKEN` on the server |
| `VITE_SERVER_API_URL` | Leave **empty** on Netlify. Same-origin `/api` is proxied to the Supabase Edge Function. |

Vite bakes these in at **build time**, so change them and trigger a new deploy after updating.

## 4. Localhost vs production

Leave `VITE_SERVER_API_URL` empty locally and on Netlify. Vite proxies `/api` to the local Edge Function (`localhost:8787`); Netlify proxies `/api` to Supabase. Do not bake a function URL into the frontend unless you want a cross-origin call.

## 6. 3D model asset

Copy your sewing-machine GLB to `web/public/models/machine.glb` before
building (it is gitignored because the file is large). Without it, the app
shows a lightweight primitive silhouette instead.

