# Tailor Assistant

WhatsApp AI assistant scoped to one tailoring machine. Built for Malayalam text and photo messages (voice notes planned). Helps with machine operation, troubleshooting, and tutorials.

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 18+ (ES modules) |
| WhatsApp | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) |
| Agent | LangGraph + Gemini 2.5 Flash (`@langchain/google-genai`) |
| Database | Supabase (Postgres + pgvector) |
| Embeddings | Google `text-embedding-004` (768 dims) |
| Video search | YouTube Data API |

## What's built so far

- Project scaffold and dependency manifest
- Supabase schema: `users`, `conversations`, `messages`, `machine_docs` + RAG function
- Stub Supabase client with placeholder DB helpers

## Not built yet

- WhatsApp (Baileys) connection
- LangGraph agent and tools
- Manual ingestion (PDF chunking + embedding into `machine_docs`)
- Voice note handling

## Setup

1. **Clone and install**

   ```bash
   git clone https://github.com/gitmen321/tailor_ai_chatbot.git
   cd tailor_ai_chatbot
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Fill in:

   - `GOOGLE_API_KEY` — Gemini + embeddings
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings
   - `YOUTUBE_API_KEY` — for tutorial search
   - `TAVILY_API_KEY` — optional web search
   - `MACHINE_BRAND` / `MACHINE_MODEL` — replace placeholders when the machine is confirmed

3. **Run (stub entry point)**

   ```bash
   npm start
   ```

## Project layout

```
src/
├── index.js              Entry point (stub)
├── db/
│   └── supabaseClient.js Supabase client + DB helpers (stubs)
├── whatsapp/             Baileys connection (later)
└── agent/                LangGraph agent (later)
    └── tools/
```

## Next step

Build the **manual ingestion script**: chunk a machine PDF manual, embed with `text-embedding-004`, and upsert rows into `machine_docs` for RAG retrieval via `match_machine_docs()`.
