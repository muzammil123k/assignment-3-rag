# Assignment 3: RAG Backend with pgvector + Production UI

A Retrieval-Augmented Generation (RAG) application built with SvelteKit, pgvector, Google Gemini, and a Python embedding microservice.

## Tech Stack

- **Frontend**: SvelteKit (Svelte 5), Tailwind CSS v4, TypeScript
- **Backend**: SvelteKit server routes, Drizzle ORM
- **Database**: PostgreSQL with pgvector extension
- **AI**: Vercel AI SDK + Google Gemini 2.5 Flash
- **Embeddings**: Python FastAPI microservice (sentence-transformers, all-mpnet-base-v2)
- **Auth**: Auth.js with database sessions, OAuth (Google + GitHub), email/password
- **Markdown**: marked + highlight.js for syntax highlighting

## Features

- **RAG Chat**: Upload documents, ask questions, get context-grounded answers with citations
- **Semantic Search**: pgvector cosine similarity over 768-dim embeddings
- **Streaming Responses**: Real-time token streaming with animated cursor
- **Tree-Structured Chat History**: Edit/regenerate creates branches (GPT-style forking)
- **Branch Navigation**: Switch between conversation branches with `< 1/3 >` controls
- **Chat Persistence**: All chats and messages stored in PostgreSQL
- **Markdown + Syntax Highlighting**: Code blocks rendered with highlight.js
- **Document Management**: Upload, list, and delete documents
- **Auth**: Email/password, Google OAuth, GitHub OAuth, role-based access
- **Admin Dashboard**: RBAC with admin role

## Quick Start

### 1. Clone and configure

```bash
git clone <repo-url>
cd assignment-3-rag
cp .env.example .env
# Fill in your secrets in .env
```

### 2. Start services

```bash
docker-compose up -d
```

This starts:
- **pgvector** PostgreSQL on port 5434
- **embed-api** Python embedding service on port 8000

### 3. Install and migrate

```bash
pnpm install
pnpm db:migrate
```

### 4. Run

```bash
pnpm dev
```

Visit:
- http://localhost:5173 - Landing page
- http://localhost:5173/healthz - Health check
- http://localhost:5173/version - Version info

## Environment Variables

See `.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | Random secret for Auth.js |
| `GITHUB_ID` / `GITHUB_SECRET` | GitHub OAuth credentials |
| `GOOGLE_ID` / `GOOGLE_SECRET` | Google OAuth credentials |
| `GEMINI_API_KEY` | Google Gemini API key |
| `EMBEDDING_API_URL` | Python embedding service URL (default: http://localhost:8000) |

## Architecture

```
User -> SvelteKit Frontend
         |
         v
  /api/chat (POST) -----> Python /embed API (port 8000)
         |                        |
         v                        v
  Google Gemini           sentence-transformers
         |                   (768-dim vectors)
         v                        |
  Streaming Response         pgvector DB
         |                  (cosine similarity)
         v                        |
  Chat UI (marked +          Top-3 chunks
  highlight.js)              as RAG context
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm db:push` | Push schema to DB |
| `pnpm db:generate` | Generate migrations |
| `pnpm db:migrate` | Run migrations |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:start` | Start Docker containers |
| `pnpm db:stop` | Stop Docker containers |
| `pnpm check` | TypeScript + Svelte check |
| `pnpm lint` | ESLint + Prettier |

## Project Structure

```
src/
  routes/
    +page.svelte              # Landing page
    dashboard/
      +layout.svelte          # Sidebar layout (auth-guarded)
      +page.svelte            # Profile page
      chat/+page.svelte       # RAG chat with branching
      documents/+page.svelte  # Document management
    api/
      chat/+server.ts         # Streaming RAG endpoint
      chats/+server.ts        # Chat CRUD
      chats/[id]/+server.ts   # Individual chat ops
    healthz/+server.ts        # Health check
    version/+server.ts        # Version info
  lib/server/db/
    schema.ts                 # Drizzle schema (users, chats, messages, documents, chunks)
    index.ts                  # DB connection
  hooks.server.ts             # Auth.js configuration
embedding-service/
  main.py                     # FastAPI embedding server
  Dockerfile                  # Container build
  requirements.txt            # Python dependencies
```
