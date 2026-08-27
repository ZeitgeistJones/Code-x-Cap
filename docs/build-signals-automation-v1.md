# Build Signals automation V1

Build Signals is an evidence-first view of curated tokenized projects that are visibly shipping.
It explains public GitHub activity alongside timestamped, exact-contract market context. It does
not infer private activity, adoption, revenue, security, or token demand.

## Daily upkeep route

`POST /api/admin/daily-upkeep`

The route:

1. Creates a `job_runs` row with `job_name = daily_upkeep` and `status = running`.
2. Stores the fixed repository and current exact-contract token lists in `job_runs.metadata`.
3. Refreshes at most one GitHub repository and one token concurrently per request.
4. Saves cursors, cumulative counts, errors, and a heartbeat after every request.
5. Groups same-project meaningful commits found during the run into one sourced `Build update`.
6. Updates the job run with final status, timestamps, counts, and short error summaries.

The short requests avoid Vercel's per-function time limit. One repository or token failure does not
abort the rest of the job. A run with partial failures is stored as `partial`; a fully successful
run is `succeeded`; a run that processes nothing is `failed`.

### Run it from the app

1. Unlock the private app with the existing admin key.
2. Open the home page.
3. Click **Run daily upkeep**.
4. Keep the page open while the button shows saved `processed/total` progress.
5. Wait for the result dialog showing GitHub, token, event, and grouped-update counts.

One click automatically makes the repeated short requests. If the browser or network interrupts
the sequence, click **Run daily upkeep** again within 30 minutes to resume the saved job.

### Call it as an authenticated request

The route accepts either:

- The existing unlocked admin cookie, used by the app button.
- An `x-admin-key` header whose value matches `ADMIN_KEY`.

The first authenticated `POST` may use an empty JSON object. It returns HTTP `202`, a `jobRunId`,
progress, and `complete: false`. Repeat authenticated `POST` requests with
`{"jobRunId":"returned-id"}` until the route returns HTTP `200` and `complete: true`.

Do not put the admin key in a public client or URL.

## Idempotency and history

- Existing raw GitHub events use deterministic keys such as
  `meaningful-{repositoryId}-{commitSha}`.
- Grouped Build updates use
  `build-update-{projectId}-{UTC date}-{digest of grouped commit identities}`.
- Event insertion uses the existing unique `(project_id, dedupe_key)` constraint and
  `onConflictDoNothing`.
- Re-running upkeep cannot duplicate the same commit or same grouped update.
- Raw meaningful-commit events remain in history. The home feed prefers the grouped update for a
  project/day; project detail preserves raw and lower-confidence records under
  **Other public activity**.
- Token contracts and market snapshots remain append-only. Market lookup uses chain ID plus exact
  contract address, never ticker alone.

## Intended schedule

The upkeep job is ready to start once per day, preferably during a consistent low-traffic UTC hour.
Vercel Cron is deliberately not configured in V1 because a Cron invocation makes only one request,
while this job now requires repeated continuation calls. A future unattended schedule must use a
durable workflow or another authenticated scheduler that keeps calling the route with the returned
`jobRunId` until `complete` is true.

## Candidate admission

The private queue is available at `/admin/candidates` and includes projects in:

- `candidate`
- `researching`
- `pre_token`
- `unverified`

The queue shows the evidence needed before tracking:

1. Official project identity source
2. Relevant public GitHub repository
3. Exact chain and contract source
4. Written reason to track

Promotion to `watch` is allowed only when:

- Identity confidence is at least 4.
- At least one attached GitHub repository is currently public/reachable.
- The current token has a non-empty source URL.

A blocked promotion leaves the existing status unchanged and explains why. Rejection requires a
short note, which is preserved in project notes. Moving to `researching` changes only the status.
Missing evidence is shown as **unknown / not verified** and is never guessed.

## Build Signals feed rules

The feed reads only sourced events of these types:

- `meaningful_commit`
- `release`
- `product_launch`
- `liquidity_threshold`
- `market_cap_threshold`
- `token_migration`
- `repo_private`
- `dormant`

Meaningful commits need a first-pass score of at least 5. Rejected and archived projects are
excluded. Only the current token is attached, and market context comes from the latest snapshot for
that exact token record.

All labels and explanations are deterministic code templates. No LLM is used.

## Known limitations

- Each route invocation processes only one repository and one token. The app must remain open while
  it sends continuation requests, or the user must click again within 30 minutes to resume.
- A running job with no saved heartbeat for 30 minutes is marked failed when upkeep is started
  again. Already written GitHub activity, events, and market snapshots remain preserved.
- Automated daily scheduling still needs a durable continuation caller; Vercel Cron alone performs
  only the first step.
- Public GitHub and market APIs can rate-limit or return incomplete data.
- Public commits do not prove that code is deployed, adopted, complete, secure, or connected to
  token economics.
- Exact-contract snapshots can be stale, thin, or unavailable.
- Current refresh paths mainly emit `meaningful_commit` and `repo_private`. Release, product,
  market-threshold, migration, and dormant events are feed-ready but are not broadly auto-generated
  in this V1.
- V1 does not configure cron, webhooks, a GitHub App, alerts, user accounts, token gating, an LLM,
  or a public score.
