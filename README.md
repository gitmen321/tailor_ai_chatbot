# Tailor Assistant

I actually built this for my mom.

She is a tailor. She works on an Usha Quick Stitch machine every day, and most of the help she needs is in Malayalam — how to set the machine, why the thread is looping, how to stitch a blouse, that kind of thing. Generic English chatbots are useless for that. So I made her an assistant that talks like it knows her, knows her machine, and answers in Malayalam.

She can use it from her phone as an installable PWA, or over WhatsApp. She can type, send a photo of the machine, or just talk. If the manual has the answer, it uses that. If it does not, it looks up tutorials and remembers what it learned.

Live app: [https://mellow-lily-dc4d1e.netlify.app/](https://tailoraichatbot.vercel.app/chat)

## Where this is going

Right now it is scoped to her — one woman, one machine, one language.

I am planning to expand this to all Mallu tailors. Same idea: Malayalam-first help for the machine they actually own, not a generic sewing FAQ. Different shops, different machines, same problem.

## What it does today

- Answers in Malayalam about her Usha Quick Stitch (and garment stitching, not only machine repair)
- Voice in, voice out — Malayalam speech-to-text and TTS, plus photos
- RAG over the real machine manual (chunked, embedded, stored in Postgres + pgvector)
- Falls back to web search and YouTube when the manual is thin, then saves those answers so it gets better over time
- Same backend for the phone PWA and WhatsApp
- Grounded in her actual machine specs so it does not invent a zig-zag machine she does not have

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

This is a modular monorepo organized by deployable boundary: the React PWA is the presentation layer, the Supabase Edge Function is the HTTP/application layer, and Postgres/pgvector plus Gemini/search providers form the data and integration layer. The agent flow retrieves manual chunks first, selectively searches external sources, builds grounded context, and generates a response. The Node server contains the manual ingestion utility and an Express reference runtime; WhatsApp is an optional adapter to the same chat API.

The primary API now validates and bounds media requests, applies an origin allowlist, and returns generic server errors. Read [SECURITY.md](./SECURITY.md) for current protections and the authentication limitation: the shared token in a browser bundle is public and does not authenticate individual users.

## Repo layout

```
supabase/   Edge Function API (chat, RAG, transcribe, speak)
server/     Node ingest script + local Express reference
web/        Phone PWA (chat, settings, 3D machine on splash)
whatsapp/   WhatsApp bridge into the same API
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
