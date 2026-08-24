# Roadmap — CODE × CAP

## Phase 0 — Architecture

- [x] Monorepo scaffold
- [x] README + architecture / data-model / roadmap docs
- [x] Drizzle schema + migrations + seed

## Phase 1 — Manual research database

- [x] Projects, tags, tokens, GitHub repos, evidence, notes, statuses
- [x] Project table + filters
- [x] Project detail page
- [x] Manual add/edit workflow
- [x] Activity signals + research scores (manual)
- [x] Event timeline (manual)
- [x] Watchlist

## Phase 2 — GitHub intelligence

Repository ingestion, commit history, meaningful commit classifier, 7d/30d activity, GitHub timeline events.

## Phase 3 — Market intelligence

Contract lookup, pools, mcap/FDV/liquidity/volume, snapshots, threshold events. Strict contract matching.

## Phase 4 — Monitoring

Worker/scheduler: GitHub, market, product, identity loops. Previous-vs-current comparison, event generation, job_runs, retries.

## Phase 5 — Intelligence dashboard

Building Now, Recently Changed, Pre-token, Pre-market, Dormant, Migrations, saved filters, scorecards.

## Phase 6 — CODE × CAP scoring

Transparent Builder Strength vs Market Quality vs composite. Liquidity-quality penalty. Weights in `packages/scoring`.

## Phase 7 — Discovery engine

Candidates → review queue. Never auto-trust ticker/repo match.

## Phase 8 — Optional AI layer

Summaries and classification assist only. Distinguish AI output from raw facts.

---

## MVP success criteria (§37)

1. Add a project manually — Phase 1  
2. Attach one or more GitHub repos — Phase 1  
3. Attach zero, one, or multiple tokens — Phase 1  
4. Verify exact contract + project identity (evidence) — Phase 1  
5. See market fields when available — Phase 3  
6. See last commit / last meaningful commit — Phase 2  
7. Separate recency: code, product, onchain, market, social — Phase 1 (manual)  
8. Project timeline — Phase 1  
9. Filter Base + &lt;$100K + meaningful code &lt;30d — Phase 2/3 for mcap; code recency filter Phase 1  
10. Distinguish tokenless / no LP / trading / migration / dormant / unverified — Phase 1  
11. Idempotent monitoring events — Phase 4  
12. Understand why scores/statuses exist — Phase 1  
