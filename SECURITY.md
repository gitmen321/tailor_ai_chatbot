# Security notes

## Current protections

- The Supabase service role key and provider API keys are server-side secrets. Never add them to `web/.env` or a `VITE_*` variable.
- The Edge Function restricts browser CORS to exact origins listed in `API_ALLOWED_ORIGINS` and rejects disallowed browser origins.
- JSON requests have a 12 MiB limit; text, audio, and image payloads have separate validation and size limits.
- Internal failures return a generic response while details stay in server logs.
- Netlify sends frame, MIME sniffing, referrer, permissions, and content security headers.
- The CSP explicitly permits WebAssembly compilation required by the Meshopt decoder used by the compressed GLB model, while keeping normal script execution restricted to same-origin files.
- `.env` files, WhatsApp session credentials, and build output are ignored by Git. Keep real credentials in deployment secret stores and rotate any credential that was ever committed or shared.

## Important authentication limitation

`VITE_API_AUTH_TOKEN` is compiled into the public browser bundle. It is a shared application secret, not user authentication; anyone who can load the site can recover it. `webUserId` is generated in local storage and is also client-controlled, so it must not be used to protect private chat history. The current setup is suitable only for a trusted, low-risk single-user demo. CORS is a browser policy and does not prevent direct API calls.

Before supporting multiple users or private data, replace the shared bearer token with per-user authentication (for example Supabase Auth access tokens), validate the token server-side, derive identity from its verified claims rather than request fields, and enforce row-level access policies for user/conversation/message data. Keep service-role access confined to trusted server code. Add shared, durable rate limits and abuse monitoring before opening expensive AI endpoints to the public.

## Operations

- Set `API_ALLOWED_ORIGINS` to the exact production PWA origin(s), comma-separated, with no trailing slash. Keep localhost entries only for development deployments.
- Use separate credentials for local, preview, and production environments.
- Review provider usage limits and rotate keys immediately if exposed.
- GitHub Actions runs `npm audit --audit-level=high` for the server, PWA, and WhatsApp bridge on pushes and pull requests to `main`.

### Dependency review (2026-11-03)

- Server: `npm install` refreshed the lockfile and reported zero vulnerabilities. Unused LangChain packages were removed; Zod was updated to the patched 4.x line.
- PWA: after non-breaking lockfile updates, `npm audit --audit-level=high` passes. npm still reports 10 low/moderate transitive advisories, chiefly in the `vite-plugin-pwa` / Workbox dependency chain (`deepmerge`, `glob`, and `minimatch`). npm's suggested blanket fix downgrades `vite-plugin-pwa` to 1.1.0, so that change was not applied.
- WhatsApp: local registry audit was not completed. The new CI job checks it on pushes and pull requests.
