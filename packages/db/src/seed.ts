import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb } from "./client";
import { projects, tags, projectTags, evidence, activitySignals, events, notes } from "./schema/index";

const TAG_SEED: Array<{ slug: string; name: string; group: string }> = [
  // Agent infrastructure
  { slug: "erc-8004", name: "ERC-8004", group: "agent_infrastructure" },
  { slug: "identity", name: "identity", group: "agent_infrastructure" },
  { slug: "reputation", name: "reputation", group: "agent_infrastructure" },
  { slug: "memory", name: "memory", group: "agent_infrastructure" },
  { slug: "mcp", name: "MCP", group: "agent_infrastructure" },
  { slug: "agent-runtime", name: "agent runtime", group: "agent_infrastructure" },
  { slug: "orchestration", name: "orchestration", group: "agent_infrastructure" },
  // Agent economy
  { slug: "x402", name: "x402", group: "agent_economy" },
  { slug: "machine-payments", name: "machine payments", group: "agent_economy" },
  { slug: "agent-marketplace", name: "agent marketplace", group: "agent_economy" },
  { slug: "agent-jobs", name: "agent jobs", group: "agent_economy" },
  { slug: "autonomous-commerce", name: "autonomous commerce", group: "agent_economy" },
  // Agent DeFi
  { slug: "trading-agent", name: "trading agent", group: "agent_defi" },
  { slug: "treasury", name: "treasury", group: "agent_defi" },
  { slug: "yield", name: "yield", group: "agent_defi" },
  { slug: "portfolio-management", name: "portfolio management", group: "agent_defi" },
  { slug: "prediction-markets", name: "prediction markets", group: "agent_defi" },
  // Data / intelligence
  { slug: "analytics", name: "analytics", group: "data_intelligence" },
  { slug: "research", name: "research", group: "data_intelligence" },
  { slug: "signals", name: "signals", group: "data_intelligence" },
  { slug: "prediction", name: "prediction", group: "data_intelligence" },
  { slug: "search", name: "search", group: "data_intelligence" },
  { slug: "data-api", name: "data API", group: "data_intelligence" },
  // Developer infrastructure
  { slug: "sdk", name: "SDK", group: "developer_infrastructure" },
  { slug: "api", name: "API", group: "developer_infrastructure" },
  { slug: "cli", name: "CLI", group: "developer_infrastructure" },
  { slug: "deployment-tooling", name: "deployment tooling", group: "developer_infrastructure" },
  { slug: "agent-hosting", name: "agent hosting", group: "developer_infrastructure" },
  // Product type
  { slug: "consumer-agent", name: "consumer agent", group: "product_type" },
  { slug: "b2b", name: "B2B", group: "product_type" },
  { slug: "api-product", name: "API", group: "product_type" },
  { slug: "protocol", name: "protocol", group: "product_type" },
  { slug: "marketplace", name: "marketplace", group: "product_type" },
  { slug: "infrastructure", name: "infrastructure", group: "product_type" },
  // Situation
  { slug: "pre-token", name: "pre-token", group: "situation" },
  { slug: "pre-market", name: "pre-market", group: "situation" },
  { slug: "migration", name: "migration", group: "situation" },
  { slug: "relaunch", name: "relaunch", group: "situation" },
  { slug: "token-utility-tbd", name: "token utility TBD", group: "situation" },
  { slug: "low-liquidity", name: "low liquidity", group: "situation" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const db = createDb(url);

  for (const tag of TAG_SEED) {
    const existing = await db.select().from(tags).where(eq(tags.slug, tag.slug)).limit(1);
    if (existing.length === 0) {
      await db.insert(tags).values(tag);
      console.log("tag:", tag.slug);
    }
  }

  const sampleSlug = "sample-agent-kit";
  const existingProject = await db.select().from(projects).where(eq(projects.slug, sampleSlug)).limit(1);
  if (existingProject.length === 0) {
    const [project] = await db
      .insert(projects)
      .values({
        slug: sampleSlug,
        name: "Sample Agent Kit",
        shortDescription: "EXAMPLE ONLY — delete after you add real projects. Illustrates Phase 1 fields.",
        longDescription:
          "This is a seeded sample so the dashboard is not empty. It is not a real investment thesis.",
        projectStatus: "pre_token",
        primaryCategory: "agent_infrastructure",
        websiteUrl: "https://example.com",
        twitterUrl: "https://x.com/example",
        primaryChain: "base",
        primaryChainId: 8453,
        identityConfidence: 2,
      })
      .returning();

    const mcp = await db.select().from(tags).where(eq(tags.slug, "mcp")).limit(1);
    const preToken = await db.select().from(tags).where(eq(tags.slug, "pre-token")).limit(1);
    if (mcp[0]) await db.insert(projectTags).values({ projectId: project.id, tagId: mcp[0].id });
    if (preToken[0]) await db.insert(projectTags).values({ projectId: project.id, tagId: preToken[0].id });

    await db.insert(evidence).values({
      projectId: project.id,
      claimField: "website",
      claimValue: "https://example.com",
      sourceUrl: "https://example.com",
      provider: "manual",
      confidence: 2,
      notes: "Sample evidence — replace with real sources",
    });

    await db.insert(activitySignals).values({
      projectId: project.id,
      signalType: "code",
      latestAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      source: "manual",
      confidence: 3,
      summary: "Sample: pretend meaningful commit 3 days ago",
    });

    await db.insert(events).values({
      projectId: project.id,
      eventType: "manual_note",
      title: "Sample project seeded",
      description: "Delete this project once you have real research entries.",
      severity: "info",
      autoGenerated: false,
      confirmed: true,
      dedupeKey: "seed-sample-note",
    });

    await db.insert(notes).values({
      projectId: project.id,
      body: "Seeded example. Safe to delete. Use Add Project for real research.",
      author: "seed",
    });

    console.log("sample project:", sampleSlug);
  } else {
    console.log("sample project already exists");
  }

  console.log("Seed complete");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
