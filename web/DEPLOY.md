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
| `VITE_SERVER_API_URL` | Your public server URL, e.g. `https://api.example.com` |
| `VITE_API_AUTH_TOKEN` | Same token as `API_AUTH_TOKEN` on the server |

Vite bakes these in at **build time**, so change them and trigger a new deploy after updating.

## 4. Localhost vs production

For local development, `web/.env` can point at:

```
VITE_SERVER_API_URL=http://127.0.0.1:3000
```

Once `server/` is deployed to a VPS, set `VITE_SERVER_API_URL` on Netlify to that public HTTPS origin (not localhost). The phone PWA cannot reach your laptop’s localhost.

Also ensure the server allows browser requests from the Netlify domain (CORS) when you put the API on the public internet.

## 6. 3D model asset

Copy your sewing-machine GLB to `web/public/models/machine.glb` before
building (it is gitignored because the file is large). Without it, the app
shows a lightweight primitive silhouette instead.

