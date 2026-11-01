# Tailor Assistant

I actually built this for my mom.

She is a tailor. She works on an Usha Quick Stitch machine every day, and most of the help she needs is in Malayalam — how to set the machine, why the thread is looping, how to stitch a blouse, that kind of thing. Generic English chatbots are useless for that. So I made her an assistant that talks like it knows her, knows her machine, and answers in Malayalam.

She can use it from her phone as an installable PWA, or over WhatsApp. She can type, send a photo of the machine, or just talk. If the manual has the answer, it uses that. If it does not, it looks up tutorials and remembers what it learned.

Live app: [https://mellow-lily-dc4d1e.netlify.app/](https://mellow-lily-dc4d1e.netlify.app/)

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
| Hosting | Netlify (web) + Supabase Edge Functions (API) |

## Repo layout

```
supabase/   Edge Function API (chat, RAG, transcribe, speak)
server/     Node ingest script + local Express reference
web/        Phone PWA (chat, settings, 3D machine on splash)
whatsapp/   WhatsApp bridge into the same API
```

Deploy notes live in [DEPLOY.md](./DEPLOY.md).

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
