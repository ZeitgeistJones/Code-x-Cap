# Architecture — CODE × CAP

## Purpose

CODE × CAP is a **builder-intelligence system**. It uses public evidence to track whether real development is happening before, during, and after market attention.

Primary relationship:

```text
PROJECT → EVIDENCE → BUILD ACTIVITY → MARKET STATE → CHANGE OVER TIME
```

It is **not** a trading terminal and does not treat marketing claims as facts.

## Engines (two systems)

### Discovery engine (Phase 7)

Finds projects not yet tracked. Produces **Candidates**. Candidates never auto-promote to tracked projects.

### Watch engine (Phase 4+)

Re-checks known projects. Independent jobs per signal type (GitHub, market, product, token identity, security). Compare current snapshot → previous snapshot; emit events only on meaningful change.

## Layers

| Layer | Package / app | Role |
|---|---|---|
| Web UI | `apps/web` | Research dashboard, manual entry, filters, detail pages |
| Worker | `apps/worker` | Scheduled monitoring (Phase 4) |
| Domain | `packages/core` | Enums, recency, slugs, shared types |
| Persistence | `packages/db` | Drizzle schema, migrations, seed |
| Connectors | `packages/connectors` | Adapter interfaces; implementations record `provider` |
| Scoring | `packages/scoring` | Transparent weights; no hidden magic score |

## Provenance

Every important factual field should eventually store:

- extracted value
- source URL / provider
- confidence where applicable
- timestamp

Never silently attach an uncertain token to a project.

## Identity chain

```text
PROJECT
  → official website
  → official social
  → GitHub org/repos
  → chain
  → exact token contract
  → DEX pools
  → market listing
```

Identity confidence is explicit (0–10). Ticker-only match = 0.

## Meaningful development

“Repo updated recently” ≠ “meaningful code shipped.” A deterministic classifier (Phase 2) scores commits; humans can override. LLM classification is optional and never authoritative.

## Recency

Separate signals: code, product, onchain, market, social, docs. Code recency is visually primary. Social activity must not look equivalent to shipping code.

Default badges: HOT ≤7d, ACTIVE 8–30d, COOLING 31–60d, DORMANT >60d, UNKNOWN.

## AI policy

AI may summarize or classify later. AI must **not** be the source of truth for market cap, contract, chain, commit date, liquidity, supply, GitHub identity, or tx counts.

## Deployment

- Next.js on Vercel (Fluid Compute / Node)
- Neon Postgres (free tier OK for Phase 1)
- Secrets only via environment variables
- Jobs must be idempotent; failures visible in `job_runs`
