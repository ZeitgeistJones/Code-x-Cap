/**
 * Complete CODE × CAP research seed pack.
 * Idempotent upsert by slug. Does NOT hardcode market caps.
 * CODE_LAST comes from GitHub refresh, not this seed.
 *
 * Run: pnpm db:seed:research
 * Or: POST /api/admin/seed-research with x-admin-key
 */
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { createDb } from "./client";
import {
  evidence,
  events,
  githubRepositories,
  projectTags,
  projects,
  tags,
  tokens,
} from "./schema/index";

export async function ensureDiscoveryColumns(db: ReturnType<typeof createDb>) {
  await db.execute(
    sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "discovery_tier" text DEFAULT 'under_the_radar' NOT NULL`,
  );
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "tracking_reason" text`);
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "research_context" text`);
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "writeup" text`);
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "whats_holding_back" text`);
  await db.execute(sql`ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "what_to_watch" text`);
}

type SeedRepo = { owner: string; repo: string; role: string };
type SeedToken = {
  symbol: string;
  ca?: string | null;
  status: string;
  sourceUrl?: string | null;
};
type SeedEvidence = { field: string; value: string; sourceUrl: string };

export type SeedProject = {
  slug: string;
  name: string;
  status: string;
  discoveryTier: string;
  category: string;
  short: string;
  website?: string | null;
  twitter?: string | null;
  chain: string;
  chainId: number;
  identity: number;
  tagSlugs: string[];
  repos: SeedRepo[];
  token?: SeedToken | null;
  writeup: string;
  whatsHoldingBack: string;
  whatToWatch: string;
  trackingReason: string;
  researchContext: string;
  evidence: SeedEvidence[];
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
  { slug: "paid-product", name: "paid product", group: "product_type" },
  { slug: "coding-agent", name: "coding agent", group: "developer_infrastructure" },
  { slug: "verification", name: "verification", group: "developer_infrastructure" },
  { slug: "filesystem", name: "filesystem", group: "developer_infrastructure" },
  { slug: "open-source", name: "open source", group: "product_type" },
  { slug: "hermes-agent", name: "Hermes Agent", group: "agent_infrastructure" },
  { slug: "claude-code", name: "Claude Code", group: "developer_infrastructure" },
  { slug: "codex", name: "Codex", group: "developer_infrastructure" },
  { slug: "token-utility", name: "token utility", group: "situation" },
  { slug: "autonomous-agent", name: "autonomous agent", group: "agent_infrastructure" },
  { slug: "token-analysis", name: "token analysis", group: "data_intelligence" },
  { slug: "defi", name: "DeFi", group: "agent_defi" },
  { slug: "self-funding", name: "self-funding", group: "agent_economy" },
  { slug: "intelligence", name: "intelligence", group: "data_intelligence" },
  { slug: "relaunch", name: "relaunch", group: "situation" },
  { slug: "inheritance", name: "inheritance", group: "product_type" },
  { slug: "legal-tech", name: "legal tech", group: "product_type" },
  { slug: "smart-contracts", name: "smart contracts", group: "developer_infrastructure" },
  { slug: "private-source", name: "private source", group: "situation" },
  { slug: "api-marketplace", name: "API marketplace", group: "agent_economy" },
  { slug: "tokenization", name: "tokenization", group: "agent_economy" },
  { slug: "evals", name: "evals", group: "developer_infrastructure" },
  { slug: "builder-agent", name: "builder agent", group: "agent_infrastructure" },
  { slug: "storage", name: "storage", group: "developer_infrastructure" },
  { slug: "rust", name: "Rust", group: "developer_infrastructure" },
  { slug: "wallet", name: "wallet", group: "agent_defi" },
  { slug: "multi-agent", name: "multi-agent", group: "agent_infrastructure" },
  { slug: "benchmark", name: "benchmark", group: "situation" },
  { slug: "compute", name: "compute", group: "developer_infrastructure" },
  { slug: "vps", name: "VPS", group: "developer_infrastructure" },
  { slug: "domains", name: "domains", group: "developer_infrastructure" },
  { slug: "self-healing", name: "self-healing", group: "agent_infrastructure" },
  { slug: "ai-agent", name: "AI agent", group: "product_type" },
  { slug: "polymarket", name: "Polymarket", group: "agent_defi" },
  { slug: "trading", name: "trading", group: "agent_defi" },
  { slug: "telegram", name: "Telegram", group: "product_type" },
  { slug: "backend", name: "backend", group: "developer_infrastructure" },
  { slug: "payments", name: "payments", group: "agent_economy" },
  { slug: "ai", name: "AI", group: "product_type" },
  { slug: "data", name: "data", group: "data_intelligence" },
  { slug: "search", name: "search", group: "data_intelligence" },
  { slug: "low-liquidity", name: "low liquidity", group: "situation" },
  { slug: "rejected", name: "rejected", group: "situation" },
  { slug: "contract-risk", name: "contract risk", group: "situation" },
  { slug: "machine-payments", name: "machine payments", group: "agent_economy" },
];

function bullets(text: string): string {
  return text
    .trim()
    .split("\n")
    .map((l) => l.replace(/^\*\s*/, "").trim())
    .filter(Boolean)
    .map((l) => `• ${l}`)
    .join("\n");
}

const SEED: SeedProject[] = [
  {
    slug: "mainstreet",
    name: "MainStreet",
    status: "pre_market",
    discoveryTier: "under_the_radar",
    category: "agent_infrastructure",
    short:
      "Onchain reputation and trust oracle for AI agents on Base using ERC-8004, x402 settlement data and agent activity.",
    website: "https://avisradar-production.up.railway.app/mainstreet.html",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["erc-8004", "x402", "reputation", "oracle", "mcp", "agent-infrastructure", "pre-market", "base"],
    repos: [{ owner: "philpof102-svg", repo: "mainstreet", role: "core" }],
    token: {
      symbol: "MAIN",
      ca: "0xb3f9760f1f1e75ba01574d98b52e4455f19e93fe",
      status: "deployed_no_market",
      sourceUrl: "https://github.com/philpof102-svg/mainstreet",
    },
    writeup: `MainStreet is one of the more interesting pre-market projects discovered during research because the development signal exists before a functioning token market does. The project is building an onchain trust and reputation layer for autonomous agents. It combines ERC-8004 identity/reputation data, x402 settlements and other agent activity into reputation signals that can theoretically be consumed by other agents before deciding whether to interact with another autonomous service.

The project has meaningful public development rather than only a landing page. During research the repository had substantial current work across the SDK, MCP schemas, oracle logic, publishing tests and contract-artifact validation.

MAIN is unusual because the token already exists but was deliberately deployed without an initial liquidity pool. That makes MainStreet better classified as PRE-MARKET rather than PRE-TOKEN.

It may be especially valuable for CODE × CAP because the system could potentially detect the transition from "builder with deployed token but no market" to "first liquidity / first real price discovery."`,
    whatsHoldingBack: `There is currently no meaningful token market, so there is no clean market valuation to compare with development activity.

The official repo explicitly described: no initial LP, no airdrop, no staking.

Token utility was also described as something to define separately rather than something deeply integrated into the current product.

Therefore MAIN should not be treated as a tradable microcap yet.`,
    whatToWatch: bullets(`* first liquidity pool
* official token utility specification
* token distribution changes
* new DEX pool
* first meaningful volume
* continued substantive GitHub development
* external integrations consuming MainStreet reputation data
* ERC-8004 ecosystem adoption`),
    trackingReason: "Potential opportunity to observe a real builder before meaningful token price discovery exists.",
    researchContext: "Treat as a genuine discovery/watch candidate rather than a benchmark.",
    evidence: [
      { field: "github_identity", value: "Official project repository", sourceUrl: "https://github.com/philpof102-svg/mainstreet" },
      { field: "token_contract", value: "0xb3f9760f1f1e75ba01574d98b52e4455f19e93fe", sourceUrl: "https://github.com/philpof102-svg/mainstreet" },
      { field: "token_supply", value: "Fixed 1,000,000 MAIN supply", sourceUrl: "https://github.com/philpof102-svg/mainstreet" },
      { field: "market_state", value: "Official repo states no initial LP", sourceUrl: "https://github.com/philpof102-svg/mainstreet" },
      { field: "product", value: "Reputation oracle using ERC-8004, x402 and agent signals", sourceUrl: "https://github.com/philpof102-svg/mainstreet" },
    ],
  },
  {
    slug: "agentbot",
    name: "Agentbot",
    status: "watch",
    discoveryTier: "under_the_radar",
    category: "agent_infrastructure",
    short:
      "Multi-tenant autonomous AI-agent hosting and deployment platform with Base/x402 infrastructure, skills, monitoring and paid managed hosting.",
    website: "https://agentbot.sh/",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["ai-agents", "agent-hosting", "x402", "openclaw", "infrastructure", "creator-tools", "base", "paid-product"],
    repos: [{ owner: "Eskyee", repo: "agentbot-opensource", role: "core" }],
    token: {
      symbol: "AGENTBOT",
      ca: "0x986b41c76ab8b7350079613340ee692773b34ba3",
      status: "trading",
      sourceUrl: "https://agentbot.sh/",
    },
    writeup: `Agentbot remains one of the cleaner low-cap builder candidates because there is an actual commercial product behind the token.

The platform offers managed AI-agent hosting rather than only issuing a speculative agent token. Its public repository contains substantially more than token contracts or documentation. It includes application code, backend infrastructure, an x402 gateway, Solidity contracts, relay infrastructure, monitoring systems, skills and deployment tooling.

The official website has advertised paid hosting plans, giving Agentbot an actual business model independent of token speculation.

The identity chain is also unusually strong: the official product site publishes the exact Base token contract and the public repository identifies itself as the open-source mirror of the production system.

This makes Agentbot one of the better examples of the CODE × CAP thesis: small token valuation + real product + meaningful technical implementation.`,
    whatsHoldingBack: `The biggest problem is development transparency.

The public repository describes itself as a mirror synchronized from a private production repository. This means public GitHub commit counts may not accurately measure the development effort.

That creates an awkward situation for CODE × CAP: the product may be actively developed, but the most important development may occur privately.

The public mirror historically contained only a small number of snapshot-style commits despite containing substantial code.

External adoption also needs stronger verification beyond the existence of the paid product.`,
    whatToWatch: bullets(`* new public mirror updates
* size and substance of mirror changes
* package releases
* customer/product usage indicators
* x402 activity
* hosting deployments
* new skills/integrations
* market liquidity
* whether public development becomes more transparent`),
    trackingReason: "One of the stronger true microcap builder candidates found.",
    researchContext:
      "Do not penalize raw public commit count without considering the production-mirror structure, but do lower confidence in development momentum when fresh public evidence cannot be independently inspected.",
    evidence: [
      { field: "website_identity", value: "Official Agentbot website", sourceUrl: "https://agentbot.sh/" },
      { field: "token_contract", value: "0x986b41C76aB8B7350079613340ee692773B34bA3", sourceUrl: "https://agentbot.sh/" },
      { field: "github_identity", value: "Official open-source production mirror", sourceUrl: "https://github.com/Eskyee/agentbot-opensource" },
      { field: "product", value: "Application, backend, x402, contracts and infrastructure", sourceUrl: "https://github.com/Eskyee/agentbot-opensource" },
    ],
  },
  {
    slug: "mythos-router",
    name: "Mythos Router",
    status: "researching",
    discoveryTier: "under_the_radar",
    category: "developer_infrastructure",
    short:
      "Local AI coding and agent-control system focused on verifiable file edits, filesystem safety, MCP, receipts, memory and multi-model routing.",
    website: "https://mythosrouter.com/",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["mcp", "cli", "coding-agent", "verification", "developer-tooling", "ai-agents", "filesystem", "open-source", "base"],
    repos: [{ owner: "thewaltero", repo: "mythos-router", role: "core" }],
    token: {
      symbol: "MYTHOS",
      ca: "0xb942b75a602fa318ac091370d93d9143ba345ba3",
      status: "trading",
      sourceUrl: "https://mythosrouter.com/",
    },
    writeup: `Mythos Router is one of the strongest unresolved CODE × CAP candidates found so far.

Unlike many agent tokens whose product is essentially a chatbot wrapper, Mythos is building tooling around the difficult problem of allowing AI coding agents to modify local systems safely and verifiably.

Its architecture includes concepts such as Strict Write Discipline, filesystem verification, tamper-evident receipts, persistent state/memory, MCP support, rollback/safety behavior and multi-provider routing.

The public repository is substantial, with hundreds of commits and significant actual implementation.

Both the official website and repository have published the same Base MYTHOS contract, giving it a strong identity chain.

The project has also historically traded at the kind of valuation CODE × CAP is designed to investigate: tens of thousands of dollars rather than millions.`,
    whatsHoldingBack: `The major unresolved issue is development recency.

During research, GitHub repository metadata indicated August activity, but some indexed commit-history and changelog views appeared stale.

Therefore CODE × CAP should not simply interpret "repository updated August 20" as "substantive source code shipped August 20."

This needs deterministic commit ingestion and changed-file analysis.

Market quality has also been weak. Even when market cap appeared interesting, trading volume was extremely small.`,
    whatToWatch: bullets(`* verify exact August commit activity
* classify August changes as code vs docs/metadata
* liquidity changes
* daily trading volume
* release activity
* MCP adoption
* external users/integrations
* developer activity continuing into September
* repo velocity relative to market valuation`),
    trackingReason:
      "Potentially the cleanest combination of real open-source engineering and very small Base market valuation.",
    researchContext:
      "High-priority full diligence candidate. Do not promote to PASS until recent substantive development is confirmed.",
    evidence: [
      { field: "website_identity", value: "Official project website", sourceUrl: "https://mythosrouter.com/" },
      { field: "github_identity", value: "Canonical Mythos Router repository", sourceUrl: "https://github.com/thewaltero/mythos-router" },
      { field: "token_contract", value: "0xb942b75a602fa318ac091370d93d9143ba345ba3", sourceUrl: "https://mythosrouter.com/" },
      { field: "token_contract_repo", value: "Official repository publishes same contract", sourceUrl: "https://github.com/thewaltero/mythos-router" },
      { field: "product", value: "Verification/MCP/agent tooling implementation", sourceUrl: "https://github.com/thewaltero/mythos-router" },
    ],
  },
  {
    slug: "hivra",
    name: "Hivra",
    status: "watch",
    discoveryTier: "niche_known",
    category: "agent_infrastructure",
    short:
      "Managed hosting platform for persistent AI agents and coding workers, evolved from HermesOS/Hermes Agent hosting into a broader AI-worker infrastructure product.",
    website: "https://hivra.cloud/",
    twitter: "https://x.com/HivraOS",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["agent-hosting", "hermes-agent", "claude-code", "codex", "infrastructure", "bankr", "token-utility", "base"],
    repos: [],
    token: {
      symbol: "HermesOS",
      ca: "0x95ccfd2b81a9667b0cc979992632f98fc853eba3",
      status: "trading",
      sourceUrl: "https://hivra.cloud/token",
    },
    writeup: `Hivra began as HermesOS, a managed hosting environment for Nous Research's Hermes Agent, and has since broadened into infrastructure for running persistent AI workers without requiring users to manage their own VPS, containers or deployment stack.

The project is interesting because it has a much more concrete consumer/business product than many agent tokens.

Hermes Agent and Claude Code deployments have been part of the product, with additional coding/agent environments planned.

The token story is also unusual. According to official project documentation, the team did not initially create the HermesOS token as a traditional project launch. A community member fair-launched it through Bankr, and the project later adopted it as the official ecosystem token.

The Hivra rebrand did NOT create a new token. HermesOS remains the token associated with the ecosystem.

Some token utility is already connected to the platform, including account/tier access and annual payments.`,
    whatsHoldingBack: `Public code transparency is much weaker than projects such as Mythos or STARKBOT.

The underlying Hermes Agent itself is open source, but Nous Research's Hermes Agent development cannot be counted as Hivra development.

CODE × CAP therefore needs to separate "technology Hivra hosts" from "technology Hivra itself built."

Some of the more attractive token-economic mechanisms, such as burns and broader builder/operator settlement, have also been described as future functionality rather than fully live systems.`,
    whatToWatch: bullets(`* public Hivra repositories
* platform releases
* new supported agent environments
* actual HermesOS payment volume
* token burns becoming live
* user/deployment counts
* recurring revenue indicators
* token utility expansion
* package releases`),
    trackingReason: "One of the strongest actual products inside the revised ≤$300K universe.",
    researchContext: "Former name HermesOS. Do not create separate Hivra and HermesOS project entities.",
    evidence: [
      { field: "identity", value: "Official Hivra transition explanation", sourceUrl: "https://hivra.cloud/why-hivra" },
      { field: "token_contract", value: "0x95ccfD2B81A9667b0Cc979992632F98fc853EBa3", sourceUrl: "https://hivra.cloud/token" },
      { field: "token_structure", value: "Official roadmap", sourceUrl: "https://hivra.cloud/roadmap" },
      { field: "product", value: "Official platform", sourceUrl: "https://hivra.cloud/" },
    ],
  },
  {
    slug: "delu",
    name: "Delu",
    status: "watch",
    discoveryTier: "niche_known",
    category: "agent_defi",
    short:
      "Autonomous trading and token-analysis agent with research loops, onchain execution, self-funded compute and x402-paid cognition APIs.",
    website: "https://www.askthequant.com/",
    twitter: "https://x.com/deluquant",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["x402", "trading-agent", "autonomous-agent", "token-analysis", "defi", "self-funding", "bankr", "erc-8004", "base"],
    repos: [
      { owner: "deluagent", repo: "delu-agent", role: "core" },
      { owner: "deluonchain", repo: "deluskill", role: "sdk" },
    ],
    token: {
      symbol: "DELU",
      ca: "0x7b0ee9dcb5c1d4d7cd630c652959951936512ba3",
      status: "trading",
      sourceUrl: "https://github.com/deluonchain/deluskill",
    },
    writeup: `DELU is one of the more interesting projects admitted after expanding the screen from $100K to $300K.

The project is centered around an autonomous trading/research agent that continuously analyzes markets, executes strategies and exposes parts of its cognition through paid x402 APIs.

The agent architecture is significantly closer to the "machine economy" thesis than many simple AI-token projects because the agent can theoretically earn money, pay for resources and expose its own services.

The public DELU skill also implements token-denominated API access rather than attaching the token solely for speculation.

The same builder ecosystem overlaps with Checkr, making the combination particularly interesting: Checkr provides attention intelligence while DELU consumes market/research information and performs autonomous analysis/execution.`,
    whatsHoldingBack: `The main weakness is public development recency.

Our previous investigation found that the key public DELU repositories did not satisfy the strict post-July-24 substantive-code requirement.

The product may still be live while development occurs privately, but that weakens the core CODE × CAP thesis when we are specifically using public builder activity as the signal.

It is also important to distinguish DELU token trading from actual third-party usage of DELU's cognition/API services.`,
    whatToWatch: bullets(`* fresh public commits
* API calls
* x402 settlement activity
* third-party consumers
* token-denominated API usage
* autonomous trading wallet activity
* new integrations
* market liquidity
* new public repos`),
    trackingReason:
      "Interesting autonomous-agent economy project with real token utility, but insufficient fresh public-code evidence.",
    researchContext: "Known niche project; verify public-code recency via GitHub ingest before ranking highly.",
    evidence: [
      { field: "token_contract", value: "0x7b0ee9dcb5c1d4d7cd630c652959951936512ba3", sourceUrl: "https://github.com/deluonchain/deluskill" },
      { field: "product", value: "Ask The Quant", sourceUrl: "https://www.askthequant.com/" },
      { field: "core_repo", value: "Public DELU agent implementation", sourceUrl: "https://github.com/deluagent/delu-agent" },
      { field: "sdk", value: "DELU skill/API repository", sourceUrl: "https://github.com/deluonchain/deluskill" },
    ],
  },
  {
    slug: "checkr",
    name: "Checkr",
    status: "watch",
    discoveryTier: "niche_known",
    category: "data_intelligence",
    short:
      "Attention-intelligence system for Base tokens measuring creator activity, mention velocity, attention rotation and other social-market signals through paid APIs.",
    website: "https://checkr.social/",
    twitter: "https://x.com/checkrsocial",
    chain: "base",
    chainId: 8453,
    identity: 9,
    tagSlugs: ["x402", "attention", "analytics", "signals", "social-data", "api", "base", "intelligence"],
    repos: [{ owner: "checkrsocial", repo: "checkr-skill", role: "sdk" }],
    token: {
      symbol: "CHECKR",
      ca: "0x2efac0a597a37050aafcf4bec627249d533dd9f8",
      status: "trading",
      sourceUrl: "https://x.com/checkrsocial",
    },
    writeup: `Checkr is one of the more convincing products among the low-cap agent ecosystem.

Rather than trying to be another autonomous chatbot, Checkr specializes in attention intelligence for Base tokens.

Its product analyzes signals such as mention velocity, creator activity, attention rotation, token-level social activity and temporal/attention dynamics.

The service exposes these signals through APIs and x402-paid endpoints. That means there is at least a clear product that another agent could consume programmatically.

Checkr is already reasonably known inside the Base/Bankr agent niche, so it should not be presented as an unknown discovery. It is included because it is a useful example of a legitimate small-token data business.`,
    whatsHoldingBack: `The most valuable signal-generation backend is not publicly inspectable.

The public checkr-skill repository primarily exposes the API/integration surface rather than the core intelligence engine.

During prior diligence, the public repository also failed the strict July-24 recency requirement.

Therefore: active product ≠ active public-code signal. This distinction should be visible in CODE × CAP.`,
    whatToWatch: bullets(`* new public repositories
* backend open-sourcing
* substantive skill/API changes
* x402 call growth
* endpoint usage
* new tokens/signals covered
* external agent integrations
* market liquidity
* developer releases`),
    trackingReason:
      "Known niche project with a real product and small token, useful for comparing product activity against public-code activity.",
    researchContext: "Do not surface as a newly discovered alpha project.",
    evidence: [
      { field: "github_identity", value: "Public Checkr repository", sourceUrl: "https://github.com/checkrsocial/checkr-skill" },
      { field: "website", value: "Official product", sourceUrl: "https://checkr.social/" },
      { field: "twitter", value: "Official account", sourceUrl: "https://x.com/checkrsocial" },
      { field: "api", value: "API documentation", sourceUrl: "https://api.checkr.social/docs" },
    ],
  },
  {
    slug: "blue-agent",
    name: "Blue Agent",
    status: "migration",
    discoveryTier: "niche_known",
    category: "agent_infrastructure",
    short:
      "AI founder console and pay-per-call agent-tool marketplace with x402, Base payments, MCP, SDK/CLI tooling and dozens of agent services.",
    website: "https://blueagent.dev/",
    twitter: "https://x.com/blueagent_",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["x402", "mcp", "sdk", "cli", "agent-marketplace", "developer-tooling", "base", "migration", "relaunch"],
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
    writeup: `Blue Agent was one of the clearest examples encountered of genuine active development.

The project contains a substantial founder console, agent tooling, x402 infrastructure, SDK/CLI functionality and a marketplace of pay-per-call AI tools.

During research, individual August updates included large multi-file changes involving USDC credit systems, payment verification, migration tooling, Merkle claims, market/data infrastructure and other substantive functionality.

This clearly passes the "real builder" test.

However, Blue Agent became a useful example of why CODE × CAP cannot simply compare current code quality to current token market cap.

The project's token structure is undergoing a migration/relaunch.`,
    whatsHoldingBack: `The current BLUEAGENT token is not a clean representation of the future project's token economy.

Research found that the existing token was being migrated into a new token structure.

Old tokens pledged into the migration were expected to be sold to help fund new liquidity, while holders would receive allocation in the new token.

The developer also warned that unpledged old tokens could become illiquid.

Additionally, BLUEAGENT credits were removed from at least one product flow and replaced with USDC/daily allowances.

Therefore the old token's market cap cannot be compared directly with the quality of the current product.

This is a SPECIAL SITUATION, not an ordinary microcap.`,
    whatToWatch: bullets(`* exact new token contract
* migration completion
* old-token liquidity removal
* new LP creation
* allocation mechanics
* new supply
* new token utility
* whether product usage creates new-token demand
* continuing August/September code activity`),
    trackingReason: "Excellent active-builder testcase and migration/relaunch testcase.",
    researchContext: "Known project. Do not surface as a fresh discovery.",
    evidence: [
      { field: "github", value: "madebyshun/blue-agent", sourceUrl: "https://github.com/madebyshun/blue-agent" },
      { field: "x402_repo", value: "blueagent-x402-services", sourceUrl: "https://github.com/madebyshun/blueagent-x402-services" },
      { field: "website", value: "Official site", sourceUrl: "https://blueagent.dev/" },
      { field: "twitter", value: "Official account", sourceUrl: "https://x.com/blueagent_" },
    ],
  },
  {
    slug: "heir",
    name: "HEIR",
    status: "watch",
    discoveryTier: "niche_known",
    category: "agent_infrastructure",
    short:
      "Digital inheritance and estate-planning platform with APIs, MCP tooling, smart-contract generation and agent-accessible legal workflows.",
    website: "https://heir.es/",
    twitter: "https://x.com/heirlegacy",
    chain: "base",
    chainId: 8453,
    identity: 8,
    tagSlugs: ["mcp", "x402", "inheritance", "legal-tech", "api", "smart-contracts", "agent-infrastructure", "private-source"],
    repos: [],
    token: { symbol: "HEIR", ca: null, status: "unknown", sourceUrl: null },
    writeup: `HEIR stood out because current shipping could be verified even though current public source code could not.

The project exposes a broader inheritance/estate-planning platform containing APIs, legal workflows, smart-contract creation and agent-facing tools.

The HEIR MCP package shipped actively during August and exposed numerous production tools against the live HEIR API.

This is useful because it represents a category that CODE × CAP needs to handle correctly: a builder can clearly be shipping while the important source repository remains private.`,
    whatsHoldingBack: `Public-code visibility is the main limitation.

Package releases and current product updates prove shipping, but they do not give the same level of technical inspection as an open core repository.

The npm metadata historically referenced a GitHub repository that was private or returned 404.

The exact HEIR contract also should be independently verified from a current project-controlled source before attaching it permanently.`,
    whatToWatch: bullets(`* official CA verification
* new public repository
* MCP package releases
* API releases
* product usage
* x402 payments
* GitHub becoming public
* expanded developer ecosystem`),
    trackingReason: 'Good testcase for "fresh shipping but private source."',
    researchContext: "Do not attach a token contract until an official project-controlled source publishes it.",
    evidence: [
      { field: "mcp", value: "@morbidcorp/heir npm", sourceUrl: "https://www.npmjs.com/package/@morbidcorp/heir" },
      { field: "ecosystem", value: "@morbidcorp/ai npm", sourceUrl: "https://www.npmjs.com/package/@morbidcorp/ai" },
      { field: "docs", value: "Official docs", sourceUrl: "https://docs.heir.es/" },
      { field: "website", value: "Official site", sourceUrl: "https://heir.es/" },
    ],
  },
  {
    slug: "apinow",
    name: "APINow.fun",
    status: "watch",
    discoveryTier: "niche_known",
    category: "agent_economy",
    short:
      "x402 API marketplace where agents discover, evaluate, purchase and monetize API services, with usage-driven tokenization of successful endpoints.",
    website: "https://www.apinow.fun/",
    twitter: "https://x.com/apinowfun",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["x402", "api-marketplace", "ai-agents", "machine-payments", "developer-tooling", "tokenization", "evals", "base"],
    repos: [],
    token: {
      symbol: "APINOW",
      ca: "0xe5dd257bab19cb8cb6b3628c09b62465ef4b2b07",
      status: "trading",
      sourceUrl: "https://www.apinow.fun/token",
    },
    writeup: `APINow is particularly interesting from an agent-economy perspective.

The platform allows agents to discover and call paid APIs using x402, creating a machine-native API marketplace.

Unlike many projects that merely talk about agent commerce, APINow publishes measurable usage statistics such as onchain API calls.

It also has an unusual token architecture: APINOW functions as the broader ecosystem token while individual API endpoints can eventually receive their own tokens after meeting usage/reliability criteria.

TRANSLATE is an example of such an endpoint token.

This gives CODE × CAP a useful multi-token ecosystem testcase.`,
    whatsHoldingBack: `The multi-token structure complicates value capture.

If successful APIs receive their own tokens, it becomes important to determine exactly what value accrues to APINOW itself versus individual endpoint tokens.

Public core-code recency has also not been as strong as the strongest open-source builder candidates.

Usage metrics need to be separated into USDC-paid calls, APINOW-linked activity, and endpoint-token-paid calls.`,
    whatToWatch: bullets(`* total x402 API calls
* APINOW-paid usage
* new endpoint tokens
* third-party API developers
* external agent integrations
* endpoint retention
* developer releases
* token-economic changes`),
    trackingReason: "One of the more measurable machine-payment products and useful multi-token architecture testcase.",
    researchContext: "Model APINOW as parent project and endpoint tokens such as TRANSLATE as associated/child tokens.",
    evidence: [
      { field: "website", value: "Official site", sourceUrl: "https://www.apinow.fun/" },
      { field: "token", value: "Official token page", sourceUrl: "https://www.apinow.fun/token" },
      { field: "roadmap", value: "Official roadmap", sourceUrl: "https://www.apinow.fun/roadmap" },
      { field: "developers", value: "Developer docs", sourceUrl: "https://www.apinow.fun/developers" },
    ],
  },
  {
    slug: "echo-builder-agent",
    name: "Echo",
    status: "watch",
    discoveryTier: "niche_known",
    category: "developer_infrastructure",
    short:
      "Builder-agent ecosystem producing x402 services, storage infrastructure, research tools, developer utilities and agent handoff systems.",
    website: "https://builtbyecho.xyz/",
    twitter: "https://x.com/BuiltByEcho",
    chain: "base",
    chainId: 8453,
    identity: 9,
    tagSlugs: ["builder-agent", "x402", "developer-tooling", "storage", "agent-infrastructure", "base", "open-source"],
    repos: [
      { owner: "BuiltByEcho", repo: "vaultline", role: "core" },
      { owner: "BuiltByEcho", repo: "agent-brief", role: "sdk" },
    ],
    token: { symbol: "ECHO", ca: null, status: "unknown", sourceUrl: null },
    writeup: `Echo is less a single-purpose agent and more of a builder ecosystem.

The BuiltByEcho organization has produced multiple agent-oriented tools, including storage infrastructure, research/developer utilities and x402-native systems.

That makes Echo useful for CODE × CAP because the engineering footprint extends across numerous repositories rather than one polished token repository.

The project is clearly real and has shipped actual products.`,
    whatsHoldingBack: `Fresh public development was the problem.

When the repository organization was screened, the newest attributable public projects appeared older than the strict July-24 cutoff.

There is also a ticker/identity risk because numerous unrelated crypto projects use ECHO.

The exact Base token contract should therefore only be attached after confirming it from a current BuiltByEcho-controlled source.`,
    whatToWatch: bullets(`* new repositories
* fresh substantive commits
* official token CA publication
* x402 usage
* Vaultline adoption
* new agent products
* cross-project integrations`),
    trackingReason: "Good example of a real multi-product builder whose public-code momentum may be cooling.",
    researchContext: "Do not attach CA until BuiltByEcho-controlled source publishes it. Avoid ECHO ticker collisions.",
    evidence: [
      { field: "github", value: "BuiltByEcho org", sourceUrl: "https://github.com/BuiltByEcho" },
      { field: "vaultline", value: "Vaultline repo", sourceUrl: "https://github.com/BuiltByEcho/vaultline" },
      { field: "agent_brief", value: "agent-brief repo", sourceUrl: "https://github.com/BuiltByEcho/agent-brief" },
      { field: "website", value: "Official site", sourceUrl: "https://builtbyecho.xyz/" },
    ],
  },
  {
    slug: "starkbot",
    name: "StarkBot",
    status: "dormant",
    discoveryTier: "benchmark",
    category: "agent_infrastructure",
    short:
      "Large Rust autonomous-agent stack with wallet execution, graph memory, x402, DeFi integrations, messaging adapters and more than 60 agent skills.",
    website: "https://starkbot.ai/",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["rust", "autonomous-agent", "x402", "defi", "wallet", "memory", "multi-agent", "open-source", "dormant", "benchmark"],
    repos: [{ owner: "ethereumdegen", repo: "stark-bot", role: "core" }],
    token: {
      symbol: "STARKBOT",
      ca: "0x587cd533f418825521f3a1daa7ccd1e7339a1b07",
      status: "trading",
      sourceUrl: "https://github.com/ethereumdegen/stark-bot",
    },
    writeup: `STARKBOT is one of the best examples discovered of why CODE × CAP needs separate BUILD SUBSTANCE and DEVELOPMENT MOMENTUM scores.

The repository is enormous compared with most microcap-agent projects.

It includes Rust backend, wallet execution, persistent graph memory, x402 payments, Aave, 0x, Polymarket, Pendle, Safe, multi-agent orchestration, chat/messaging adapters, dozens of skills, and dashboard/frontend.

The repo contains roughly 550 commits.

Purely on historical build substance, STARKBOT is one of the highest-quality projects examined.`,
    whatsHoldingBack: `Public development stopped.

The actual commit history showed the latest public work around March 30, 2026.

Therefore 550 historical commits should not outweigh months of inactivity.

STARKBOT is a perfect example of: "excellent codebase, weak current builder signal."`,
    whatToWatch: bullets(`* first new substantive commit
* project relaunch
* package release
* new integration
* revived X/product activity
* trading/liquidity revival
* ERC-8004/x402 updates`),
    trackingReason: "High-quality dormant benchmark.",
    researchContext: "Do not rank highly based solely on historical commit count.",
    evidence: [
      { field: "github", value: "ethereumdegen/stark-bot", sourceUrl: "https://github.com/ethereumdegen/stark-bot" },
      { field: "website", value: "Official site", sourceUrl: "https://starkbot.ai/" },
    ],
  },
  {
    slug: "otonix",
    name: "Otonix",
    status: "dormant",
    discoveryTier: "under_the_radar",
    category: "agent_infrastructure",
    short:
      "Autonomous infrastructure layer allowing agents to provision VPS servers, register domains, manage DNS, self-heal and pay infrastructure costs through x402.",
    website: "https://otonix.tech/",
    twitter: "https://x.com/otonix_tech",
    chain: "base",
    chainId: 8453,
    identity: 8,
    tagSlugs: ["x402", "compute", "vps", "domains", "autonomous-agents", "infrastructure", "self-healing", "base", "dormant"],
    repos: [
      { owner: "otonix-ai", repo: "otonix", role: "core" },
      { owner: "otonix-ai", repo: "agent", role: "experimental" },
    ],
    token: { symbol: "OTX", ca: null, status: "unknown", sourceUrl: null },
    writeup: `Otonix has one of the more unusual autonomous-agent infrastructure concepts.

Instead of focusing on trading or chat, it attempts to give autonomous agents control over the infrastructure they need to exist.

The public implementation includes functionality around VPS provisioning, x402 USDC payments, domain registration, DNS, infrastructure lifecycle, autonomous recovery/self-healing, and agent APIs.

This is conceptually very aligned with the machine-economy thesis: an agent that can purchase and maintain its own infrastructure.`,
    whatsHoldingBack: `Development appears stale.

The principal public repo contains meaningful code but only a very small number of commits, with activity concentrated around early 2026.

That raises the possibility that the repository is more of a public code snapshot than evidence of ongoing open development.

The exact current OTX contract should also be verified again from an official Otonix-controlled source before attaching it permanently.`,
    whatToWatch: bullets(`* fresh commits
* product availability
* active VPS provisioning
* x402 settlements
* official OTX CA
* package releases
* domain transactions
* new infrastructure integrations`),
    trackingReason: "Interesting architecture, but currently a dormant/revival candidate.",
    researchContext: "Do not attach OTX CA until official source publishes it.",
    evidence: [
      { field: "github", value: "otonix-ai/otonix", sourceUrl: "https://github.com/otonix-ai/otonix" },
      { field: "historical", value: "otonix-ai/agent", sourceUrl: "https://github.com/otonix-ai/agent" },
      { field: "website", value: "Official site", sourceUrl: "https://otonix.tech/" },
    ],
  },
  {
    slug: "zer0",
    name: "ZER0",
    status: "dormant",
    discoveryTier: "under_the_radar",
    category: "agent_defi",
    short:
      "AI-agent application with market analysis, Polymarket integration, Telegram interaction, payments, automated jobs and trade-oriented backend infrastructure.",
    chain: "base",
    chainId: 8453,
    identity: 8,
    tagSlugs: ["ai-agent", "polymarket", "trading", "telegram", "backend", "payments", "base", "dormant"],
    repos: [],
    token: { symbol: "ZER0", ca: null, status: "unknown", sourceUrl: null },
    writeup: `ZER0 was a good example of a token that initially looked much more interesting after inspecting its actual code.

The public application repository had roughly 55 commits and contained legitimate product infrastructure including Supabase schema, asynchronous agent jobs, Polymarket integration, Telegram bot functionality, payments, trading routes, and backend/application logic.

So this was clearly more than an empty token repository.`,
    whatsHoldingBack: `Development momentum died.

The builder's public ZER0 repositories were last updated around May 2026, far outside the current CODE × CAP active-builder window.

The project therefore fails the main thesis: we are specifically looking for builders who are shipping now.

The exact token CA should also be re-established through the identity pipeline before import if it cannot be independently resolved.`,
    whatToWatch: bullets(`* repo revival
* new releases
* product uptime
* Polymarket activity
* agent transactions
* liquidity revival
* new public code`),
    trackingReason: "Useful dormant microcap benchmark with historically real application code.",
    researchContext:
      "Repo was referenced as zer0-analysis in research notes — attach exact owner/repo only when verified. CA left empty until official source.",
    evidence: [],
  },
  {
    slug: "thesis",
    name: "THESIS",
    status: "dormant",
    discoveryTier: "niche_known",
    category: "agent_defi",
    short:
      "Autonomous AI committee that evaluates token theses posted on X, trades approved Base tokens and distributes realized profits.",
    website: "https://thesisonbase.com/",
    twitter: "https://x.com/thesisonbase",
    chain: "base",
    chainId: 8453,
    identity: 10,
    tagSlugs: ["ai-agents", "trading-agent", "autonomous-trading", "treasury", "bankr", "buyback-burn", "base", "dormant"],
    repos: [{ owner: "thesisAI1", repo: "thesis", role: "core" }],
    token: {
      symbol: "THESIS",
      ca: "0x36e807119529e44d6f36ad5ce24aeb87a4529ba3",
      status: "low_liquidity",
      sourceUrl: "https://thesisonbase.com/docs.html",
    },
    writeup: `THESIS was one of the most impressive projects encountered from a historical build perspective.

Its system implemented an actual multi-agent investment workflow: X thesis submission → eligibility filtering → author analysis → token analysis → LLM committee judgment → position sizing → Base execution → TP/SL monitoring → realized-profit distribution.

The architecture included dedicated Registrar, Auditor, Dean, Bursar, Monitor and Endowment components.

The product also had a meaningful token-economic connection: profitable trading could contribute to THESIS buyback/burn.

Onchain investigation found evidence that the advertised trading wallet really transacted.

So THESIS should not be classified as a fake project.`,
    whatsHoldingBack: `It appears to have gone dormant.

The last verified public GitHub commit was June 1, 2026.

The token market subsequently deteriorated dramatically, with extremely low liquidity and negligible volume.

That means its tiny market cap may represent abandonment rather than overlooked active development.

THESIS is therefore a classic CODE × CAP false positive if recency is ignored.`,
    whatToWatch: bullets(`* new GitHub commit
* canonical trading-wallet activity
* renewed thesis submissions
* buyback/burn activity
* restored liquidity
* product relaunch
* new agent features`),
    trackingReason: "Excellent dormant/revival benchmark.",
    researchContext: "Keep for dormancy/revival detection, not as a current PASS.",
    evidence: [
      { field: "github", value: "thesisAI1/thesis", sourceUrl: "https://github.com/thesisAI1/thesis" },
      { field: "website", value: "Official site", sourceUrl: "https://thesisonbase.com/" },
      { field: "docs", value: "Official docs", sourceUrl: "https://thesisonbase.com/docs.html" },
    ],
  },
  {
    slug: "arbus",
    name: "Arbus",
    status: "watch",
    discoveryTier: "niche_known",
    category: "data_intelligence",
    short: "AI/data infrastructure project with Base token and x402-adjacent product activity.",
    chain: "base",
    chainId: 8453,
    identity: 8,
    tagSlugs: ["ai", "data", "x402", "base", "private-source", "watch"],
    repos: [],
    token: { symbol: "ARBUS", ca: null, status: "unknown", sourceUrl: null },
    writeup: `Arbus appeared to be a legitimate Base AI/data product rather than a pure meme token.

Its project identity and live product looked credible, and it fit the broader x402/agent-data ecosystem being researched.`,
    whatsHoldingBack: `The biggest problem is public-code verification.

Targeted searches using the project domain, contract, product names and official accounts did not reveal a public source repository that could confidently be attributed to the project.

Without inspectable public code, Arbus cannot score highly under the current CODE × CAP methodology.

Market activity was also extremely thin during the original screen.`,
    whatToWatch: bullets(`* official GitHub publication
* SDK release
* package release
* new developer docs
* x402 usage
* liquidity
* trading activity`),
    trackingReason: "Legitimate product candidate but weak public-development visibility.",
    researchContext: "CA left empty until official attributable source. Code not publicly verifiable group.",
    evidence: [],
  },
  {
    slug: "sniper-search",
    name: "Sniper Search",
    status: "watch",
    discoveryTier: "under_the_radar",
    category: "data_intelligence",
    short: "Base-native crypto search/research product associated with the SS token.",
    chain: "base",
    chainId: 8453,
    identity: 8,
    tagSlugs: ["search", "research", "intelligence", "base", "low-liquidity", "private-source"],
    repos: [],
    token: { symbol: "SS", ca: null, status: "unknown", sourceUrl: null },
    writeup: `Sniper Search was confirmed as a real Base token/product rather than a ticker collision.

The project fits the broader agent/search intelligence thesis and historically traded at a very small valuation.`,
    whatsHoldingBack: `Two major weaknesses:

1. No convincing attributable public source repository was established.
2. Trading activity was nearly nonexistent during screening.

Therefore the low market cap does not currently provide a convincing "code versus valuation" discrepancy because the code itself cannot be inspected.`,
    whatToWatch: bullets(`* official GitHub
* product releases
* API launch
* liquidity recovery
* sustained volume
* external integrations`),
    trackingReason: "Low-priority watch candidate.",
    researchContext: "CA left empty until official source. Code not publicly verifiable group.",
    evidence: [],
  },
  {
    slug: "mio",
    name: "MIO",
    status: "rejected",
    discoveryTier: "benchmark",
    category: "agent_economy",
    short: "Base token previously surfaced through the x402 ecosystem search.",
    chain: "base",
    chainId: 8453,
    identity: 7,
    tagSlugs: ["x402", "base", "rejected", "low-liquidity", "contract-risk"],
    repos: [],
    token: { symbol: "MIO", ca: null, status: "abandoned", sourceUrl: null },
    writeup: `MIO is worth keeping primarily as a negative testcase for CODE × CAP.

It surfaced in the right thematic ecosystem and existed on Base, demonstrating why simple token-directory discovery is insufficient.`,
    whatsHoldingBack: `The market was effectively dead.

When investigated: there were no meaningful active trading pairs, historical volume was negligible, and market quality was extremely poor.

There were also warnings concerning contract control/upgradeability, including owner powers that could potentially affect token behavior.

This is exactly the kind of token CODE × CAP should automatically deprioritize even if the nominal market cap is extremely small.`,
    whatToWatch: bullets(`* meaningful liquidity appears
* public development appears
* contract-control concerns change
* legitimate product usage emerges`),
    trackingReason: 'Negative benchmark for "tiny does not equal asymmetric."',
    researchContext: "Negative benchmark group. Do not treat tiny mcap as opportunity.",
    evidence: [],
  },
];

async function ensureTag(db: ReturnType<typeof createDb>, slug: string): Promise<string> {
  const existing = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const extra = EXTRA_TAGS.find((t) => t.slug === slug);
  const [row] = await db
    .insert(tags)
    .values(
      extra ?? {
        slug,
        name: slug.replace(/-/g, " "),
        group: "situation",
      },
    )
    .returning();
  return row.id;
}

async function upsertProject(db: ReturnType<typeof createDb>, p: SeedProject) {
  const now = new Date();
  const existing = await db.select().from(projects).where(eq(projects.slug, p.slug)).limit(1);

  const values = {
    name: p.name,
    shortDescription: p.short,
    longDescription: p.writeup,
    projectStatus: p.status,
    discoveryTier: p.discoveryTier,
    trackingReason: p.trackingReason,
    researchContext: p.researchContext,
    writeup: p.writeup,
    whatsHoldingBack: p.whatsHoldingBack,
    whatToWatch: p.whatToWatch,
    primaryCategory: p.category,
    websiteUrl: p.website ?? null,
    twitterUrl: p.twitter ?? null,
    primaryChain: p.chain,
    primaryChainId: p.chainId,
    identityConfidence: p.identity,
    lastReviewedAt: now,
    updatedAt: now,
  };

  let projectId: string;
  if (existing[0]) {
    await db.update(projects).set(values).where(eq(projects.id, existing[0].id));
    projectId = existing[0].id;
    console.log("updated:", p.slug);
  } else {
    const [created] = await db
      .insert(projects)
      .values({ slug: p.slug, ...values })
      .returning();
    projectId = created.id;
    console.log("created:", p.slug);
  }

  // Replace tags
  await db.delete(projectTags).where(eq(projectTags.projectId, projectId));
  for (const tagSlug of p.tagSlugs) {
    const tagId = await ensureTag(db, tagSlug);
    await db.insert(projectTags).values({ projectId, tagId }).onConflictDoNothing();
  }

  // Repos — insert missing only (unique owner/repo)
  for (const r of p.repos) {
    const found = await db
      .select()
      .from(githubRepositories)
      .where(eq(githubRepositories.owner, r.owner))
      .limit(20);
    const match = found.find((x) => x.repo === r.repo);
    if (!match) {
      try {
        await db.insert(githubRepositories).values({
          projectId,
          owner: r.owner,
          repo: r.repo,
          url: `https://github.com/${r.owner}/${r.repo}`,
          repoRole: r.role,
          identityVerified: true,
        });
      } catch (e) {
        console.warn(`repo skip ${r.owner}/${r.repo}:`, e instanceof Error ? e.message : e);
      }
    } else if (match.projectId !== projectId) {
      console.warn(`repo ${r.owner}/${r.repo} already linked to another project — left as-is`);
    }
  }

  // Token — only if CA or symbol; never invent CA
  if (p.token) {
    const ca = p.token.ca?.trim().toLowerCase() || null;
    const existingTokens = await db.select().from(tokens).where(eq(tokens.projectId, projectId));
    const byCa = ca ? existingTokens.find((t) => t.contractAddress === ca) : null;
    const bySymbol = existingTokens.find(
      (t) => (t.symbol ?? "").toLowerCase() === p.token!.symbol.toLowerCase() && t.isCurrent,
    );

    if (byCa) {
      await db
        .update(tokens)
        .set({
          symbol: p.token.symbol,
          tokenStatus: p.token.status,
          sourceUrl: p.token.sourceUrl ?? null,
          isCurrent: true,
          updatedAt: now,
        })
        .where(eq(tokens.id, byCa.id));
    } else if (bySymbol && !ca) {
      await db
        .update(tokens)
        .set({
          tokenStatus: p.token.status,
          sourceUrl: p.token.sourceUrl ?? null,
          updatedAt: now,
        })
        .where(eq(tokens.id, bySymbol.id));
    } else if (ca || p.token.symbol) {
      // If attaching CA, require sourceUrl
      if (ca && !p.token.sourceUrl) {
        console.warn(`${p.slug}: CA without SOURCE_URL — inserting as unverified/unknown without overwriting`);
      }
      if (ca) {
        await db
          .update(tokens)
          .set({ isCurrent: false, updatedAt: now })
          .where(eq(tokens.projectId, projectId));
      }
      try {
        await db.insert(tokens).values({
          projectId,
          symbol: p.token.symbol,
          name: p.name,
          chain: p.chain,
          chainId: p.chainId,
          contractAddress: ca,
          tokenStatus: ca && p.token.sourceUrl ? p.token.status : ca ? "unknown" : p.token.status,
          tokenRole: "primary",
          isCurrent: true,
          sourceUrl: p.token.sourceUrl ?? null,
          contractVerified: false,
        });
      } catch (e) {
        console.warn(`${p.slug} token insert:`, e instanceof Error ? e.message : e);
      }
    }
  }

  // Evidence — replace for seed freshness
  await db.delete(evidence).where(eq(evidence.projectId, projectId));
  for (const e of p.evidence) {
    await db.insert(evidence).values({
      projectId,
      claimField: e.field,
      claimValue: e.value,
      sourceUrl: e.sourceUrl,
      provider: "manual_research",
      confidence: p.identity,
    });
  }

  await db
    .insert(events)
    .values({
      projectId,
      eventType: "manual_note",
      title: "Research seed pack imported/updated",
      description: `discovery_tier=${p.discoveryTier}; status=${p.status}`,
      severity: "info",
      autoGenerated: false,
      confirmed: true,
      dedupeKey: `research-seed-pack-v2-${p.slug}`,
    })
    .onConflictDoNothing();
}

export async function seedResearchProjects(connectionString?: string) {
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const db = createDb(url);
  await ensureDiscoveryColumns(db);

  for (const t of EXTRA_TAGS) {
    const existing = await db.select().from(tags).where(eq(tags.slug, t.slug)).limit(1);
    if (!existing[0]) await db.insert(tags).values(t);
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
