"use server";

import {
  ACTIVITY_SIGNAL_TYPES,
  DISCOVERY_TIERS,
  isLikelyEvmAddress,
  SCORE_DIMENSIONS,
  slugify,
} from "@codexcap/core";
import {
  activitySignals,
  evidence,
  events,
  githubRepositories,
  notes,
  projectTags,
  projects,
  researchScores,
  tags,
  tokens,
  watchlistItems,
} from "@codexcap/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { db } from "@/lib/db";

async function assertAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function optStr(formData: FormData, key: string): string | null {
  const v = str(formData, key);
  return v ? v : null;
}

function optInt(formData: FormData, key: string): number | null {
  const v = str(formData, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function parseTagIds(formData: FormData): string[] {
  return formData.getAll("tagIds").map(String).filter(Boolean);
}

function parseRepoLines(raw: string): Array<{ owner: string; repo: string; role: string }> {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      // owner/repo or full URL, optional |role
      const [left, rolePart] = line.split("|").map((s) => s.trim());
      const role = rolePart || "core";
      const cleaned = left
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/\.git$/i, "")
        .replace(/\/$/, "");
      const [owner, repo] = cleaned.split("/");
      if (!owner || !repo) throw new Error(`Invalid GitHub repo: ${line}`);
      return { owner, repo, role };
    });
}

export async function createProjectAction(formData: FormData) {
  await assertAuth();
  const database = db();

  const name = str(formData, "name");
  if (!name) throw new Error("Name is required");

  let slug = str(formData, "slug") || slugify(name);
  const existing = await database.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  if (existing.length) slug = `${slug}-${Date.now().toString(36)}`;

  const contractAddress = optStr(formData, "contractAddress");
  const tokenSourceUrl = optStr(formData, "tokenSourceUrl");
  const chain = optStr(formData, "chain") ?? "base";
  const chainId = optInt(formData, "chainId") ?? 8453;
  let projectStatus = str(formData, "projectStatus") || "researching";
  let identityConfidence = optInt(formData, "identityConfidence") ?? 0;

  if (contractAddress && !tokenSourceUrl) {
    projectStatus = "unverified";
    identityConfidence = Math.min(identityConfidence, 3);
  }
  if (contractAddress && chainId !== 0 && !isLikelyEvmAddress(contractAddress)) {
    throw new Error("Contract address does not look like a valid EVM address");
  }

  const now = new Date();
  const [project] = await database
    .insert(projects)
    .values({
      name,
      slug,
      shortDescription: optStr(formData, "shortDescription"),
      longDescription: optStr(formData, "longDescription"),
      projectStatus,
      discoveryTier: str(formData, "discoveryTier") || "under_the_radar",
      trackingReason: optStr(formData, "trackingReason"),
      researchContext: optStr(formData, "researchContext"),
      writeup: optStr(formData, "writeup"),
      whatsHoldingBack: optStr(formData, "whatsHoldingBack"),
      whatToWatch: optStr(formData, "whatToWatch"),
      primaryCategory: optStr(formData, "primaryCategory"),
      websiteUrl: optStr(formData, "websiteUrl"),
      twitterUrl: optStr(formData, "twitterUrl"),
      logoUrl: optStr(formData, "logoUrl"),
      primaryChain: chain,
      primaryChainId: chainId,
      identityConfidence,
      lastReviewedAt: now,
      updatedAt: now,
    })
    .returning();

  for (const tagId of parseTagIds(formData)) {
    await database.insert(projectTags).values({ projectId: project.id, tagId });
  }

  const reposRaw = str(formData, "repositories");
  if (reposRaw) {
    for (const r of parseRepoLines(reposRaw)) {
      await database.insert(githubRepositories).values({
        projectId: project.id,
        owner: r.owner,
        repo: r.repo,
        url: `https://github.com/${r.owner}/${r.repo}`,
        repoRole: r.role,
        identityVerified: false,
      });
    }
  }

  if (contractAddress || str(formData, "tokenSymbol")) {
    await database.insert(tokens).values({
      projectId: project.id,
      symbol: optStr(formData, "tokenSymbol"),
      name: optStr(formData, "tokenName") ?? name,
      chain,
      chainId,
      contractAddress: contractAddress?.toLowerCase() ?? null,
      tokenStatus: str(formData, "tokenStatus") || (contractAddress ? "unknown" : "announced"),
      tokenRole: str(formData, "tokenRole") || "primary",
      isCurrent: true,
      sourceUrl: tokenSourceUrl,
      contractVerified: false,
    });
  }

  if (tokenSourceUrl && contractAddress) {
    await database.insert(evidence).values({
      projectId: project.id,
      claimField: "token_contract",
      claimValue: contractAddress.toLowerCase(),
      sourceUrl: tokenSourceUrl,
      provider: "manual",
      confidence: identityConfidence || 4,
      notes: "Entered at project creation",
    });
  }

  if (optStr(formData, "websiteUrl")) {
    await database.insert(evidence).values({
      projectId: project.id,
      claimField: "website",
      claimValue: str(formData, "websiteUrl"),
      sourceUrl: str(formData, "websiteUrl"),
      provider: "manual",
      confidence: 5,
    });
  }

  const noteBody = optStr(formData, "note");
  if (noteBody) {
    await database.insert(notes).values({ projectId: project.id, body: noteBody, author: "admin" });
  }

  await database.insert(events).values({
    projectId: project.id,
    eventType: "manual_note",
    title: "Project added",
    description: "Manually entered into CODE × CAP research database",
    severity: "info",
    autoGenerated: false,
    confirmed: true,
    dedupeKey: `created-${project.id}`,
  });

  // Optional manual code signal
  const codeAt = optStr(formData, "codeLatestAt");
  if (codeAt) {
    await database.insert(activitySignals).values({
      projectId: project.id,
      signalType: "code",
      latestAt: new Date(codeAt),
      source: "manual",
      confidence: 5,
      summary: optStr(formData, "codeSummary") ?? "Manual code activity",
    });
  }

  revalidatePath("/");
  redirect(`/projects/${project.slug}`);
}

export async function updateProjectAction(formData: FormData) {
  await assertAuth();
  const database = db();
  const id = str(formData, "id");
  const slug = str(formData, "slug");
  if (!id) throw new Error("Missing id");

  const now = new Date();
  await database
    .update(projects)
    .set({
      name: str(formData, "name"),
      slug,
      shortDescription: optStr(formData, "shortDescription"),
      longDescription: optStr(formData, "longDescription"),
      projectStatus: str(formData, "projectStatus") || "researching",
      discoveryTier: str(formData, "discoveryTier") || "under_the_radar",
      trackingReason: optStr(formData, "trackingReason"),
      researchContext: optStr(formData, "researchContext"),
      writeup: optStr(formData, "writeup"),
      whatsHoldingBack: optStr(formData, "whatsHoldingBack"),
      whatToWatch: optStr(formData, "whatToWatch"),
      primaryCategory: optStr(formData, "primaryCategory"),
      websiteUrl: optStr(formData, "websiteUrl"),
      twitterUrl: optStr(formData, "twitterUrl"),
      logoUrl: optStr(formData, "logoUrl"),
      primaryChain: optStr(formData, "chain"),
      primaryChainId: optInt(formData, "chainId"),
      identityConfidence: optInt(formData, "identityConfidence") ?? 0,
      lastReviewedAt: now,
      updatedAt: now,
    })
    .where(eq(projects.id, id));

  await database.delete(projectTags).where(eq(projectTags.projectId, id));
  for (const tagId of parseTagIds(formData)) {
    await database.insert(projectTags).values({ projectId: id, tagId });
  }

  revalidatePath("/");
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function deleteProjectAction(formData: FormData) {
  await assertAuth();
  const id = str(formData, "id");
  await db().delete(projects).where(eq(projects.id, id));
  revalidatePath("/");
  redirect("/");
}

export async function addTokenAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  const contractAddress = optStr(formData, "contractAddress");
  const sourceUrl = optStr(formData, "sourceUrl");
  const chain = str(formData, "chain") || "base";
  const chainId = optInt(formData, "chainId") ?? 8453;

  if (contractAddress && chainId > 0 && !isLikelyEvmAddress(contractAddress)) {
    throw new Error("Invalid EVM contract address");
  }
  if (contractAddress && !sourceUrl) {
    throw new Error("source_url required when attaching a contract — identity provenance");
  }

  const database = db();
  const isCurrent = str(formData, "isCurrent") === "on" || str(formData, "isCurrent") === "true";
  if (isCurrent) {
    await database
      .update(tokens)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(tokens.projectId, projectId));
  }

  await database.insert(tokens).values({
    projectId,
    symbol: optStr(formData, "symbol"),
    name: optStr(formData, "name"),
    chain,
    chainId,
    contractAddress: contractAddress?.toLowerCase() ?? null,
    tokenStatus: str(formData, "tokenStatus") || "unknown",
    tokenRole: str(formData, "tokenRole") || "primary",
    isCurrent,
    sourceUrl,
    contractVerified: false,
  });

  if (contractAddress && sourceUrl) {
    await database.insert(evidence).values({
      projectId,
      claimField: "token_contract",
      claimValue: contractAddress.toLowerCase(),
      sourceUrl,
      provider: "manual",
      confidence: optInt(formData, "confidence") ?? 5,
    });
    await database.insert(events).values({
      projectId,
      eventType: "token_deployed",
      title: `Token recorded: ${optStr(formData, "symbol") ?? contractAddress.slice(0, 10)}`,
      description: `Chain ${chain}; source ${sourceUrl}`,
      sourceUrl,
      severity: "medium",
      autoGenerated: false,
      confirmed: true,
      dedupeKey: `token-${chainId}-${contractAddress.toLowerCase()}`,
    });
  }

  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function addRepoAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  const owner = str(formData, "owner");
  const repo = str(formData, "repo");
  if (!owner || !repo) throw new Error("owner/repo required");

  await db().insert(githubRepositories).values({
    projectId,
    owner,
    repo,
    url: `https://github.com/${owner}/${repo}`,
    repoRole: str(formData, "repoRole") || "core",
    identityVerified: str(formData, "identityVerified") === "on",
  });

  await db().insert(events).values({
    projectId,
    eventType: "new_repo",
    title: `Repo attached: ${owner}/${repo}`,
    sourceUrl: `https://github.com/${owner}/${repo}`,
    severity: "info",
    autoGenerated: false,
    confirmed: true,
    dedupeKey: `repo-${owner}-${repo}`,
  });

  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function addEvidenceAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  await db().insert(evidence).values({
    projectId,
    claimField: str(formData, "claimField"),
    claimValue: str(formData, "claimValue"),
    sourceUrl: str(formData, "sourceUrl"),
    provider: optStr(formData, "provider") ?? "manual",
    confidence: optInt(formData, "confidence") ?? 5,
    notes: optStr(formData, "notes"),
  });
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function addNoteAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  await db().insert(notes).values({
    projectId,
    body: str(formData, "body"),
    author: "admin",
  });
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function addEventAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  const ts = optStr(formData, "timestamp");
  await db().insert(events).values({
    projectId,
    eventType: str(formData, "eventType") || "manual_note",
    title: str(formData, "title"),
    description: optStr(formData, "description"),
    sourceUrl: optStr(formData, "sourceUrl"),
    severity: str(formData, "severity") || "info",
    timestamp: ts ? new Date(ts) : new Date(),
    autoGenerated: false,
    confirmed: true,
    dedupeKey: optStr(formData, "dedupeKey") ?? `manual-${Date.now()}`,
  });
  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function upsertSignalAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  const signalType = str(formData, "signalType");
  if (!ACTIVITY_SIGNAL_TYPES.includes(signalType as (typeof ACTIVITY_SIGNAL_TYPES)[number])) {
    throw new Error("Invalid signal type");
  }
  const database = db();
  const existing = await database
    .select()
    .from(activitySignals)
    .where(and(eq(activitySignals.projectId, projectId), eq(activitySignals.signalType, signalType)))
    .limit(1);

  const latestAt = optStr(formData, "latestAt");
  const values = {
    latestAt: latestAt ? new Date(latestAt) : null,
    source: optStr(formData, "source") ?? "manual",
    confidence: optInt(formData, "confidence") ?? 5,
    summary: optStr(formData, "summary"),
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await database.update(activitySignals).set(values).where(eq(activitySignals.id, existing[0].id));
  } else {
    await database.insert(activitySignals).values({ projectId, signalType, ...values });
  }

  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function upsertScoreAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  const dimension = str(formData, "dimension");
  if (!SCORE_DIMENSIONS.includes(dimension as (typeof SCORE_DIMENSIONS)[number])) {
    throw new Error("Invalid dimension");
  }
  const score = optInt(formData, "score");
  if (score == null || score < 0 || score > 10) throw new Error("Score must be 0–10");

  const database = db();
  const existing = await database
    .select()
    .from(researchScores)
    .where(and(eq(researchScores.projectId, projectId), eq(researchScores.dimension, dimension)))
    .limit(1);

  const values = {
    score,
    explanation: optStr(formData, "explanation"),
    evidenceSource: optStr(formData, "evidenceSource"),
    isManual: true,
    scoredAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing[0]) {
    await database.update(researchScores).set(values).where(eq(researchScores.id, existing[0].id));
  } else {
    await database.insert(researchScores).values({ projectId, dimension, ...values });
  }

  if (dimension === "identity_confidence") {
    await database
      .update(projects)
      .set({ identityConfidence: score, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  revalidatePath(`/projects/${slug}`);
  redirect(`/projects/${slug}`);
}

export async function toggleWatchlistAction(formData: FormData) {
  await assertAuth();
  const projectId = str(formData, "projectId");
  const slug = str(formData, "slug");
  const database = db();
  const existing = await database
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.projectId, projectId))
    .limit(1);
  if (existing[0]) {
    await database.delete(watchlistItems).where(eq(watchlistItems.id, existing[0].id));
  } else {
    await database.insert(watchlistItems).values({ projectId });
  }
  revalidatePath("/");
  revalidatePath("/watchlist");
  revalidatePath(`/projects/${slug}`);
  redirect(str(formData, "redirectTo") || `/projects/${slug}`);
}

export async function createTagAction(formData: FormData) {
  await assertAuth();
  const name = str(formData, "name");
  const group = str(formData, "group") || "situation";
  const slug = str(formData, "slug") || slugify(name);
  await db().insert(tags).values({ name, slug, group, description: optStr(formData, "description") });
  revalidatePath("/tags");
  redirect("/tags");
}
