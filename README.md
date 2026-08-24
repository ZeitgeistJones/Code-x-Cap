# CODE × CAP

**Builder-intelligence tracker** for crypto projects — starting with small AI-agent / machine-economy projects on Base.

> Track what projects are actually building, connect that development activity to the correct token/project identity, organize by type and status, monitor repeatedly, and surface meaningful changes over time.

This is **not** another price tracker. The core relationship is:

**PROJECT → EVIDENCE → BUILD ACTIVITY → MARKET STATE → CHANGE OVER TIME**

## Current phase

**Phase 0 + Phase 1** — architecture, database, and a usable **manual research database** (add/edit projects, tokens, repos, evidence, notes, timeline, filters).

Automation (GitHub loops, market snapshots, workers) comes in later phases. Do not expect live market or commit ingestion yet.

## Stack

| Piece | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Web | Next.js (App Router) + TypeScript + Tailwind |
| Database | PostgreSQL (Neon) + Drizzle |
| Hosting | Vercel |
| Access | Private — `ADMIN_KEY` |

## Repository layout

```text
apps/web          Next.js dashboard + admin
apps/worker       Stub (Phase 4)
packages/db       Drizzle schema, migrations, seed
packages/core     Domain types, enums, recency helpers
packages/connectors  Provider interfaces (stubs)
packages/scoring  Score formula module (stub until Phase 6)
packages/ui       Shared UI helpers (thin)
docs/             Architecture, data model, roadmap
```

## Setup (local)

1. Install [Node 20+](https://nodejs.org/) and [pnpm](https://pnpm.io/).
2. Create a free [Neon](https://neon.tech) Postgres database.
3. Copy `.env.example` → `apps/web/.env.local` (and root `.env` for db scripts):

```bash
DATABASE_URL=postgresql://...
ADMIN_KEY=choose-a-long-secret
```

4. From repo root:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000 — unlock with your `ADMIN_KEY`.

## Setup (Vercel)

**Easiest (no Output Directory toggle needed):**

1. Import the GitHub repo.
2. Click **Edit** next to **Root Directory** → **clear it** (use the repo root, not `apps/web`).
3. Leave Build/Output toggles off — root `vercel.json` sets:
   - Build: `pnpm --filter @codexcap/web build`
   - Output: `apps/web/.next`
4. Env vars: `DATABASE_URL`, `ADMIN_KEY`.
5. Run Neon migration SQL from `packages/db/drizzle/0000_phase0_init.sql`.

If Root Directory is already `apps/web` and you can’t change Output Directory, clear Root Directory as above and redeploy.

## Docs

- [Architecture](docs/architecture.md)
- [Data model](docs/data-model.md)
- [Roadmap](docs/roadmap.md)

## Philosophy

Evidence first. Project identity over ticker matching. History never overwritten. Monitoring must be idempotent. AI is optional analysis — never the source of market caps, contracts, or commit dates.
