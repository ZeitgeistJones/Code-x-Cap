# Data model — CODE × CAP

Project-centric relational model. A project may have zero, one, or many tokens; many repos; many products/contracts/chains. **Never** design around one-token-per-row assumptions. Deprecated tokens remain in history.

## Core enums

### Project status

`candidate` | `researching` | `pass` | `watch` | `pre_token` | `pre_market` | `migration` | `unverified` | `dormant` | `rejected` | `archived`

### Token status

`announced` | `deployed_no_market` | `trading` | `low_liquidity` | `migration_pending` | `deprecated` | `abandoned` | `unknown`

### Token role

`primary` | `legacy` | `bridge` | `utility` | `governance` | `other`

### Repo role

`core` | `backend` | `frontend` | `sdk` | `contracts` | `mcp` | `cli` | `docs` | `deployment` | `experimental`

### Activity signal type

`code` | `product` | `onchain` | `market` | `social` | `docs`

### Score dimension

`identity_confidence` | `build_substance` | `development_momentum` | `product_reality` | `market_quality` | `external_adoption` | `trust_security` | `asymmetry`

### Event types (selected)

`meaningful_commit` | `release` | `new_repo` | `product_launch` | `token_announced` | `token_deployed` | `liquidity_created` | `liquidity_removed` | `token_migration` | `contract_changed` | `market_cap_threshold` | `liquidity_threshold` | `dormant` | `reactivated` | `manual_note` | …

## Tables

### projects

Identity + research lifecycle. Scheduling fields (`last_reviewed_at`, `next_check_at`) reserved for watch engine.

### tags / project_tags

Extensible taxonomy (agent infra, economy, DeFi, data, developer infra, product type, situation).

### tokens

Separate from projects. `is_current`, `migration_target_token_id`. Unique on `(chain_id, contract_address)` when address present. **Never overwrite** an old contract during migration — insert new row, mark old deprecated.

### github_repositories

Multiple per project. `identity_verified` flag. Activity metrics filled in Phase 2+.

### github_activities

Notable commits with classification + `meaningful_score` (Phase 2).

### market_snapshots

Historical market rows per token (Phase 3). Never only store latest.

### evidence

Provenance records: claim field, value, source_url, provider, confidence.

### notes

Manual research notes.

### events

Chronological timeline. `auto_generated` + `confirmed`. Deduped by jobs later.

### activity_signals

One row per (project, signal_type) for latest; history via events / dedicated history later. Phase 1 allows manual timestamps.

### research_scores

Component scores with explanation, timestamp, manual vs automated.

### watchlist_items

Single-admin watchlist.

### job_runs

Observability for monitors (Phase 4).

### project_usage

Product usage metrics separate from trading volume (later).

### alerts / alert_subscriptions

Alert architecture stubs (later).

## Identity confidence

0–10. Examples: 10 = multiple independent official links; 0 = ticker-only. Attaching a token without evidence should leave project/token as `unverified` or require a source URL.
