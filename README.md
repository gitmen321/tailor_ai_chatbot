# Tailor Assistant

I actually built this for my mom.

She is a tailor. She works on an Usha Quick Stitch machine every day, and most of the help she needs is in Malayalam — how to set the machine, why the thread is looping, how to stitch a blouse, that kind of thing. Generic English chatbots are useless for that. So I made her an assistant that talks like it knows her, knows her machine, and answers in Malayalam.

The PWA is the multi-user product: each tailor signs in, saves their name and machine, then chats by text, photo, or voice. A separate Baileys WhatsApp bot remains available through its legacy server credential; it is not linked to PWA accounts in this release.

Live app: [https://tailoraichatbot.vercel.app/chat](https://tailoraichatbot.vercel.app/chat)

## Where this is going

Right now it is scoped to her — one woman, one machine, one language.

I am planning to expand this to all Mallu tailors. Same idea: Malayalam-first help for the machine they actually own, not a generic sewing FAQ. Different shops, different machines, same problem.

## What it does today

- Answers in Malayalam about her Usha Quick Stitch (and garment stitching, not only machine repair)
- Voice in, voice out — Malayalam speech-to-text and TTS, plus photos
- RAG over the real machine manual (chunked, embedded, stored in Postgres + pgvector)
- Falls back to web search and YouTube when the manual is thin, then saves those answers so it gets better over time
- PWA accounts keep their own profile, machine brand/model, and private chat history
- Grounded in each account’s saved machine details; the assistant does not assume unprovided machine specifications

## Stack

| Layer | What I used |
|-------|-------------|
| Phone app | React PWA (Vite, installable, works on iPhone and Android) |
| API | Supabase Edge Function (Deno) — chat, RAG, STT, TTS |
| Model | Gemini (chat, Malayalam STT/TTS, embeddings) |
| Knowledge | Supabase Postgres + pgvector |
| WhatsApp | Baileys (optional long-running process) |
| Hosting | Netlify or Vercel (web) + Supabase Edge Functions (API) |

## Architecture and security

The React PWA handles account setup and chat. The Supabase Edge API validates Auth sessions, applies shared rate limits, then routes requests through controllers and use cases to database repositories and provider adapters. Postgres stores private account profiles, machine details, conversations, and messages; shared manuals are searched with pgvector. Learned answers are scoped to their owner. The Node server retains ingestion tooling and the legacy Express reference runtime. The Baileys bot remains a separate server-side integration and is not linked to PWA accounts.

Read [SECURITY.md](./SECURITY.md) for Auth, RLS, rate-limit, logging, and rollout requirements. The demo supports email/password accounts without email confirmation and Google OAuth for allowlisted testers. Configure SMTP before enabling email verification, password recovery, or magic-link sign-in. Configure CAPTCHA and Upstash Redis before opening paid API routes.

## Repo layout

```
supabase/   Edge Function API (chat, RAG, transcribe, speak)
server/     Node ingest script + local Express reference
web/        Phone PWA (chat, settings, 3D machine on splash)
whatsapp/   Separate Baileys bot using the legacy chat endpoint
```

Deploy notes for both hosts live in [DEPLOY.md](./DEPLOY.md). The repository keeps `web/netlify.toml` and also includes a root [`vercel.json`](./vercel.json), so either hosting workflow can be used without changing the application code.

## Run it locally

You need Node 22+.

```bash
# Embed the machine manual once (Node CLI — not a hosted server)
cd server
cp .env.example .env   # fill in keys
npm install
npm run ingest

# API — Supabase Edge Function locally (Deno)
cd ..
$env:PORT=8787; deno run --allow-net --allow-env --allow-read --env-file=server/.env supabase/functions/api/index.ts

# PWA (another terminal)
cd web
cp .env.example .env
npm install
npm run dev
```

The web app proxies `/api` to the local Edge Function on port 8787. Leave `VITE_SERVER_API_URL` empty.

WhatsApp is optional:

```bash
cd whatsapp
cp .env.example .env
npm install
npm start
```

## Why it exists

I did not start this as a product. I started it because my mom needed help in the language she actually uses, on the machine she actually has.

If it works for her, it can work for other Mallu tailors too. That is the plan.
