# Security notes

## Current protections

- The Supabase service role key and provider API keys are server-side secrets. Never add them to `web/.env` or a `VITE_*` variable.
- The Edge Function restricts browser CORS to exact origins listed in `API_ALLOWED_ORIGINS` and rejects disallowed browser origins.
- JSON requests have a 12 MiB limit; text, audio, and image payloads have separate validation and size limits.
- Internal failures return a generic response while details stay in server logs.
- Netlify sends frame, MIME sniffing, referrer, permissions, and content security headers.
- The CSP explicitly permits WebAssembly compilation required by the Meshopt decoder used by the compressed GLB model, while keeping normal script execution restricted to same-origin files.
- `.env` files, WhatsApp session credentials, and build output are ignored by Git. Keep real credentials in deployment secret stores and rotate any credential that was ever committed or shared.

## Account authentication and private data

- The PWA signs in with Supabase Auth email/password or Google OAuth. Edge routes validate the bearer token with Supabase Auth and derive the account ID from the verified user record; request fields and browser storage are not used as identity.
- Demo email/password sign-up has email confirmation disabled so users can start without SMTP. Treat submitted email addresses as unverified; don't use their email value to make identity or authorization decisions. Require a unique password. Enable confirmation and password-reset email only after testing SMTP delivery.
- The browser uses only the Supabase publishable/anon key. The service-role key remains confined to the Edge Function.
- A migration adds an Auth identity to user profiles and row-level policies for profile, conversation, and message reads/updates. Shared manual documents remain unavailable through direct user table access. Chat-derived learned answers are stored and retrieved by Auth owner so they do not cross accounts.
- Existing legacy user rows are left unassigned. Do not map them to a new account until an operator has verified the correct owner.
- The separate Baileys bridge still uses a server-only `WHATSAPP_API_AUTH_TOKEN` for its legacy chat path. Rotate any token that was previously bundled into the PWA; never set that token as a `VITE_*` variable. No PWA account linking is implemented for WhatsApp.

## Authentication and API rate limits

- Supabase Auth applies native limits to password registration and sign-in. Configure the project’s Auth rate limits and enable Turnstile CAPTCHA in the Supabase dashboard. The PWA passes the Turnstile token for email/password sign-up and sign-in when `VITE_TURNSTILE_SITE_KEY` is configured.
- Chat, speech, transcription, profile, and history routes use a shared Upstash Redis sliding-window limiter. Limits are keyed by a SHA-256 digest of the user or IP identity. Missing or unavailable Redis credentials fail closed with `503`, before paid model work starts.
- Default chat limits are 10 requests per user per minute, 100 per user per rolling day, and 1,000 globally per rolling day. Media defaults are 20 per user per minute, 50 per user per rolling day, and 2,000 globally per rolling day. These are configurable through the `CHAT_*`, `MEDIA_*`, and `API_IP_RATE_LIMIT_PER_MINUTE` Edge secrets.
- `429` responses indicate the configured limit was reached. Monitor usage and provider bills, then tune defaults before increasing concurrency.

## Operations

- Set `API_ALLOWED_ORIGINS` to the exact production PWA origin(s), comma-separated, with no trailing slash. Keep localhost entries only for development deployments.
- Use separate credentials for local, preview, and production environments.
- Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` before enabling chat or media routes; the API deliberately rejects paid work if they are absent.
- Configure Supabase Auth providers, redirect allowlists, rate limits, and CAPTCHA. In demo mode, email confirmation is off and password recovery is unavailable without SMTP. Google OAuth Testing mode must list tester accounts. Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_TURNSTILE_SITE_KEY` in the PWA build environment. Configure SMTP before turning email confirmation or email password recovery on.
- Use the `X-Request-ID` response header to find the corresponding structured Edge log entry. Logs include route, status, duration, error category/type, and identity kind; they do not include prompts or message content.
- Apply `supabase/migrations/20261118175150_multi_user_accounts_and_rls.sql` only after reviewing the migration and rechecking that no user has multiple conversations. This checkout has not applied the migration to production.
- Review provider usage limits and rotate keys immediately if exposed.
- GitHub Actions runs `npm audit --audit-level=high` for the server, PWA, and WhatsApp bridge on pushes and pull requests to `main`.

### Dependency review (2026-11-03)

- Server: `npm install` refreshed the lockfile and reported zero vulnerabilities. Unused LangChain packages were removed; Zod was updated to the patched 4.x line.
- PWA: after non-breaking lockfile updates, `npm audit --audit-level=high` passes. npm still reports 10 low/moderate transitive advisories, chiefly in the `vite-plugin-pwa` / Workbox dependency chain (`deepmerge`, `glob`, and `minimatch`). npm's suggested blanket fix downgrades `vite-plugin-pwa` to 1.1.0, so that change was not applied.
- WhatsApp: local registry audit was not completed. The new CI job checks it on pushes and pull requests.
