import { sql, eq } from "drizzle-orm";
import { createDb } from "./client";
import {
  activitySignals,
  evidence,
  events,
  githubRepositories,
  notes,
  projectTags,
  projects,
  tags,
  tokens,
} from "./schema/index";

/** Ensure discovery columns exist (safe to re-run). */
export async function ensureDiscoveryColumns(db: ReturnType<typeof createDb>) {
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "discovery_tier" text DEFAULT 'under_the_radar' NOT NULL`);
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tracking_reason" text`);
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "research_context" text`);
}

type SeedProject = {
  slug: string;
  name: string;
  status: string;
  discoveryTier: string;
  trackingReason: string;
  researchContext: string;
  category: string;
  short: string;
  website?: string;
  twitter?: string;
  chain: string;
  chainId: number;
  identity: number;
  tagSlugs: string[];
  repos: Array<{ owner: string; repo: string; role: string }>;
  token?: {
    symbol: string;
    ca: string;
    status: string;
    sourceUrl: string;
  };
  notes: string;
  evidence: Array<{ field: string; value: string; sourceUrl: string }>;
  codeLast?: string;
};

const EXTRA_TAGS: Array<{ slug: string; name: string; group: string }> = [
  { slug: "oracle", name: "oracle", group: "agent_infrastructure" },
  { slug: "agent-infrastructure", name: "agent infrastructure", group: "agent_infrastructure" },
  { slug: "ai-agents", name: "AI agents", group: "product_type" },
  { slug: "autonomous-trading", name: "autonomous trading", group: "agent_defi" },
  { slug: "bankr", name: "Bankr", group: "situation" },
  { slug: "buyback-burn", name: "buyback burn", group: "situation" },
  { slug: "dormant", name: "dormant", group: "situation" },
  { slug: "agent-marketplace", name: "agent marketplace", group: "agent_economy" },
  { slug: "developer-tooling", name: "developer tooling", group: "developer_infrastructure" },
  { slug: "base", name: "Base", group: "situation" },
  { slug: "attention", name: "attention", group: "data_intelligence" },
  { slug: "social-data", name: "social data", group: "data_intelligence" },
  { slug: "openclaw", name: "OpenClaw", group: "agent_infrastructure" },
  { slug: "creator-tools", name: "creator tools", group: "product_type" },
];

const SEED: SeedProject[] = [
  {
    slug: "mainstreet",
    name: "MainStreet",
    status: "pre_market",
    discoveryTier: "under_the_radar",
    trackingReason:
      "High-value discovery/watch candidate: active Base agent-infrastructure builder with a deployed token but no meaningful market yet. Useful for detecting a future LP/market launch.",
    researchContext: "Treat as a genuine discovery/watchlist candidate rather than a benchmark project.",
    category: "agent_infrastructure",
    short:
      "Onchain reputation and trust oracle for AI agents on Base using ERC-8004, x402 settlement data, and agent activity.",
    website: "https://avisradar-production.up.railway.app/mainstreet.html",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["erc-8004", "x402", "reputation", "oracle", "mcp", "agent-infrastructure", "pre-market"],
    repos: [{ owner: "philpof102-svg", repo: "mainstreet", role: "core" }],
    token: {
      symbol: "MAIN",
      ca: "0xb3f9760f1f1e75ba01574d98b52e4455f19e93fe",
      status: "deployed_no_market",
      sourceUrl: "https://github.com/philpof102-svg/mainstreet",
    },
    notes:
      "Token is already deployed but the official repo explicitly says there was no initial LP, no airdrop, and no staking. Token utility is intentionally TBD. Treat as pre-market, not as a normal tradable microcap.",
    evidence: [
      {
        field: "github_identity",
        value: "Official repo describes MainStreet and links its live deployment",
        sourceUrl: "https://github.com/philpof102-svg/mainstreet",
      },
      {
        field: "token_contract",
        value: "0xb3f9760f1f1e75ba01574d98b52e4455f19e93fe",
        sourceUrl: "https://github.com/philpof102-svg/mainstreet",
      },
      {
        field: "token_supply",
        value: "1,000,000 MAIN fixed immutable supply",
        sourceUrl: "https://github.com/philpof102-svg/mainstreet",
      },
      {
        field: "market_state",
        value: "Official repo states no initial LP",
        sourceUrl: "https://github.com/philpof102-svg/mainstreet",
      },
      {
        field: "product",
        value: "Reputation oracle for onchain agents using ERC-8004, x402 and Virtuals ACP signals",
        sourceUrl: "https://github.com/philpof102-svg/mainstreet",
      },
    ],
  },
  {
    slug: "thesis",
    name: "THESIS",
    status: "dormant",
    discoveryTier: "niche_known",
    trackingReason:
      "Useful historical benchmark: substantial real product/code existed, but public development and token-market activity later went dormant.",
    researchContext:
      "Keep to test dormancy, revival detection, liquidity collapse, and historical builder-vs-market comparisons.",
    category: "agent_defi",
    short:
      "Autonomous AI committee that evaluates token theses posted on X, trades approved Base tokens, and distributes profits.",
    website: "https://thesisonbase.com/",
    twitter: "https://x.com/thesisonbase",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: [
      "ai-agents",
      "trading-agent",
      "treasury",
      "autonomous-trading",
      "bankr",
      "buyback-burn",
      "dormant",
    ],
    repos: [{ owner: "thesisAI1", repo: "thesis", role: "core" }],
    token: {
      symbol: "THESIS",
      ca: "0x36e807119529e44d6f36ad5ce24aeb87a4529ba3",
      status: "low_liquidity",
      sourceUrl: "https://thesisonbase.com/docs.html",
    },
    notes:
      "Strong historical build substance and a real onchain product, but our research found development momentum and token liquidity had deteriorated sharply. Keep for historical comparison and revival monitoring rather than as a current PASS.",
    evidence: [
      {
        field: "github_identity",
        value: "Official project site links thesisAI1/thesis and repo identifies itself as the canonical THESIS system",
        sourceUrl: "https://github.com/thesisAI1/thesis",
      },
      {
        field: "token_contract",
        value: "0x36e807119529E44d6F36aD5CE24AeB87a4529ba3",
        sourceUrl: "https://thesisonbase.com/docs.html",
      },
      {
        field: "product",
        value:
          "Official repo describes the complete agent pipeline from X thesis intake through grading, Base trading, monitoring and payout",
        sourceUrl: "https://github.com/thesisAI1/thesis",
      },
      {
        field: "token_utility",
        value: "Official docs state winning trades fund THESIS buyback and burn",
        sourceUrl: "https://thesisonbase.com/docs.html",
      },
    ],
  },
  {
    slug: "blue-agent",
    name: "Blue Agent",
    status: "migration",
    discoveryTier: "niche_known",
    trackingReason:
      "Known within the Base/Bankr agent niche. Included because it is an excellent migration/relaunch special-situation test case, not because it is a newly discovered obscure project.",
    researchContext:
      "Do not surface as a fresh alpha discovery. Track as a known active builder whose old token is being migrated/restructured.",
    category: "agent_infrastructure",
    short:
      "Base-native AI founder console and pay-per-call tool marketplace with x402, MCP, CLI/SDK tooling and onchain agent services.",
    website: "https://blueagent.dev/",
    twitter: "https://x.com/blueagent_",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["x402", "mcp", "sdk", "cli", "agent-marketplace", "developer-tooling", "base", "migration"],
    repos: [
      { owner: "madebyshun", repo: "blue-agent", role: "core" },
      { owner: "madebyshun", repo: "blueagent-x402-services", role: "experimental" },
    ],
    token: {
      symbol: "BLUEAGENT",
      ca: "0xf895783b2931c919955e18b5e3343e7c7c456ba3",
      status: "migration_pending",
      sourceUrl: "https://github.com/madebyshun/blue-agent",
    },
    notes:
      "Public repo is highly substantive and explicitly ties this contract to Blue Agent. Prior research found active migration/relaunch work, so do not treat the old token's current market cap as a clean valuation of the future token. Independently ingest current migration state from the repo before assigning any market score.",
    evidence: [
      {
        field: "github_identity",
        value: "Official repo identifies Blue Agent, website, X account and Base-only architecture",
        sourceUrl: "https://github.com/madebyshun/blue-agent",
      },
      {
        field: "token_contract",
        value: "0xf895783b2931c919955e18b5e3343e7c7c456ba3",
        sourceUrl: "https://github.com/madebyshun/blue-agent",
      },
      {
        field: "product",
        value:
          "Official repo describes a founder console plus a marketplace of pay-per-call AI tools using x402 USDC on Base",
        sourceUrl: "https://github.com/madebyshun/blue-agent",
      },
      {
        field: "secondary_repo",
        value: "Official Blue Agent x402 services repository",
        sourceUrl: "https://github.com/madebyshun/blueagent-x402-services",
      },
    ],
  },
  {
    slug: "checkr",
    name: "Checkr",
    status: "watch",
    discoveryTier: "niche_known",
    trackingReason:
      "Known within the Base/Bankr agent niche. Included because it is a useful example of an active product with a small token but insufficient fresh public-code evidence under the strict CODE × CAP rules.",
    researchContext:
      "Do not surface as a fresh alpha discovery. Track as a known project/benchmark for product activity versus public-code activity.",
    category: "data_intelligence",
    short:
      "Attention-intelligence layer for Base tokens that tracks mention velocity, creator rotation, Hawkes-modeled attention signals and x402-paid API access.",
    website: "https://checkr.social/",
    twitter: "https://x.com/checkrsocial",
    chain: "base",
    chainId: 8453,
    identity: 9,
    tagSlugs: ["x402", "attention", "analytics", "signals", "social-data", "api", "base"],
    repos: [{ owner: "checkrsocial", repo: "checkr-skill", role: "sdk" }],
    token: {
      symbol: "CHECKR",
      ca: "0x2efac0a597a37050aafcf4bec627249d533dd9f8",
      status: "trading",
      sourceUrl: "https://x.com/checkrsocial",
    },
    notes:
      "Product is active, but the public GitHub repo is primarily the integration/skill surface rather than the private backend that computes the intelligence. Keep as WATCH unless fresh substantive public code qualifies under the CODE × CAP recency rule.",
    evidence: [
      {
        field: "github_identity",
        value: "Public checkrsocial repo documents the Checkr API and checkr.social product",
        sourceUrl: "https://github.com/checkrsocial/checkr-skill",
      },
      {
        field: "token_contract",
        value: "0x2efac0a597a37050aafcf4bec627249d533dd9f8",
        sourceUrl: "https://x.com/checkrsocial",
      },
      {
        field: "product",
        value: "Official public repo documents Base attention intelligence and x402-paid endpoints",
        sourceUrl: "https://github.com/checkrsocial/checkr-skill",
      },
      {
        field: "api_docs",
        value: "Checkr API documentation describes token, leaderboard, signal, creator and health endpoints",
        sourceUrl: "https://api.checkr.social/docs",
      },
    ],
  },
  {
    slug: "agentbot",
    name: "Agentbot",
    status: "watch",
    discoveryTier: "under_the_radar",
    trackingReason:
      "Relatively obscure microcap builder candidate with a real paid product and an unusual public-mirror/private-production repo structure.",
    researchContext:
      "Treat as a research/watch candidate, while making the public-mirror limitation explicit when scoring development momentum.",
    category: "agent_infrastructure",
    short:
      "Multi-tenant autonomous AI-agent platform with managed deployments, Base/x402 infrastructure, agent identity, creator systems and production hosting.",
    website: "https://agentbot.sh/",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["ai-agents", "agent-hosting", "x402", "openclaw", "infrastructure", "creator-tools", "base"],
    repos: [{ owner: "Eskyee", repo: "agentbot-opensource", role: "core" }],
    token: {
      symbol: "AGENTBOT",
      ca: "0x986b41c76ab8b7350079613340ee692773b34ba3",
      status: "trading",
      sourceUrl: "https://agentbot.sh/",
    },
    notes:
      "Official site displays the exact Base contract and links the live Agentbot product. Official repo says it is an open-source mirror synced from the private production repo, so public commit counts may understate private development. Treat code recency from the public mirror carefully.",
    evidence: [
      {
        field: "website_identity",
        value: "Official Agentbot site describes paid live agent hosting and displays AGENTBOT liquidity information",
        sourceUrl: "https://agentbot.sh/",
      },
      {
        field: "token_contract",
        value: "0x986b41C76aB8B7350079613340ee692773B34bA3",
        sourceUrl: "https://agentbot.sh/",
      },
      {
        field: "github_identity",
        value: "Official public repo identifies itself as the live product-code mirror for Agentbot and links agentbot.sh",
        sourceUrl: "https://github.com/Eskyee/agentbot-opensource",
      },
      {
        field: "product",
        value:
          "Official repo contains web app, backend, gateway, contracts, monitoring, skills and deployment infrastructure",
        sourceUrl: "https://github.com/Eskyee/agentbot-opensource",
      },
    ],
  },
];

async function ensureTag(
  db: ReturnType<typeof createDb>,
  slug: string,
): Promise<string | null> {
  const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const extra = EXTRA_TAGS.find((t) => t.slug === slug);
  if (!extra) {
    // create under situation group as fallback
    const [row] = await db
      .insert(tags)
      .values({ slug, name: slug.replace(/-/g, " "), group: "situation" })
      .returning();
    return row.id;
  }
  const [row] = await db.insert(tags).values(extra).returning();
  return row.id;
}

async function upsertProject(db: ReturnType<typeof createDb>, p: SeedProject) {
  const existing = await db.select().from(projects).where(eq(projects.slug, p.slug)).limit(1);
  if (existing[0]) {
    console.log("skip (exists):", p.slug);
    return;
  }

  const now = new Date();
  const [project] = await db
    .insert(projects)
    .values({
      slug: p.slug,
      name: p.name,
      shortDescription: p.short,
      longDescription: `${p.researchContext}\n\nTracking: ${p.trackingReason}`,
      projectStatus: p.status,
      discoveryTier: p.discoveryTier,
      trackingReason: p.trackingReason,
      researchContext: p.researchContext,
      primaryCategory: p.category,
      websiteUrl: p.website ?? null,
      twitterUrl: p.twitter ?? null,
      primaryChain: p.chain,
      primaryChainId: p.chainId,
      identityConfidence: p.identity,
      lastReviewedAt: now,
      updatedAt: now,
    })
    .returning();

  for (const tagSlug of p.tagSlugs) {
    const tagId = await ensureTag(db, tagSlug);
    if (tagId) {
      await db.insert(projectTags).values({ projectId: project.id, tagId }).onConflictDoNothing();
    }
  }

  for (const r of p.repos) {
    await db.insert(githubRepositories).values({
      projectId: project.id,
      owner: r.owner,
      repo: r.repo,
      url: `https://github.com/${r.owner}/${r.repo}`,
      repoRole: r.role,
      identityVerified: true,
    });
  }

  if (p.token) {
    await db.insert(tokens).values({
      projectId: project.id,
      symbol: p.token.symbol,
      name: p.name,
      chain: p.chain,
      chainId: p.chainId,
      contractAddress: p.token.ca.toLowerCase(),
      tokenStatus: p.token.status,
      tokenRole: "primary",
      isCurrent: true,
      sourceUrl: p.token.sourceUrl,
      contractVerified: false,
    });
  }

  for (const e of p.evidence) {
    await db.insert(evidence).values({
      projectId: project.id,
      claimField: e.field,
      claimValue: e.value,
      sourceUrl: e.sourceUrl,
      provider: "manual_research",
      confidence: p.identity,
    });
  }

  await db.insert(notes).values({
    projectId: project.id,
    body: p.notes,
    author: "research-seed",
  });

  await db.insert(events).values({
    projectId: project.id,
    eventType: "manual_note",
    title: "Seeded from research paste",
    description: `discovery_tier=${p.discoveryTier}; status=${p.status}`,
    severity: "info",
    autoGenerated: false,
    confirmed: true,
    dedupeKey: `research-seed-${p.slug}`,
  });

  if (p.codeLast) {
    await db.insert(activitySignals).values({
      projectId: project.id,
      signalType: "code",
      latestAt: new Date(p.codeLast),
      source: "manual",
      confidence: 5,
      summary: "Manual code signal from research seed",
    });
  }

  console.log("seeded:", p.slug);
}

export async function seedResearchProjects(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const db = createDb(url);
  await ensureDiscoveryColumns(db);

  for (const t of EXTRA_TAGS) {
    const existing = await db.select().from(tags).where(eq(tags.slug, t.slug)).limit(1);
    if (!existing[0]) {
      await db.insert(tags).values(t);
      console.log("tag:", t.slug);
    }
  }

  for (const p of SEED) {
    await upsertProject(db, p);
  }

  return { ok: true as const, count: SEED.length, slugs: SEED.map((p) => p.slug) };
}

const isCli = typeof process !== "undefined" && process.argv[1]?.includes("seed-research");
if (isCli) {
  seedResearchProjects()
    .then((r) => {
      console.log("Research seed complete", r);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
