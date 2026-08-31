import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSignalCopy,
  collapseMeaningfulCommitsByDay,
  commitMessageFromDescription,
  isGenericCaveat,
  type BuildSignalCopyInput,
  type CollapsibleBuildEvent,
} from "./buildSignals";

function baseInput(overrides: Partial<BuildSignalCopyInput> = {}): BuildSignalCopyInput {
  return {
    projectName: "Blue Agent",
    projectStatus: "migration",
    eventType: "meaningful_commit",
    eventTitle: "Meaningful commit on madebyshun/blue-agent",
    eventDescription: "feat: add x402 paywall for agent tools · score 9/10 · substantive_feature",
    classification: "substantive_feature",
    meaningfulScore: 9,
    commitCount: 1,
    commitHeadlines: ["feat: add x402 paywall for agent tools"],
    happenedAt: "2026-08-28T12:00:00.000Z",
    shortDescription:
      "AI founder console and pay-per-call agent-tool marketplace with x402, Base payments, MCP, SDK/CLI tooling.",
    trackingReason: "Track the migration, not the old ticker tape.",
    identityConfidence: 10,
    identityLabel: "verified",
    tokenSymbol: "BLUEAGENT",
    tokenChain: "base",
    tokenContract: "0xf895",
    tokenSourceUrl: "https://example.com",
    contractVerified: true,
    marketLabel: "researchable",
    marketCap: 38500,
    liquidityUsd: 36900,
    marketSource: "dexscreener",
    marketSnapshotAt: "2026-08-31T12:00:00.000Z",
    ...overrides,
  };
}

function event(partial: Partial<CollapsibleBuildEvent> & Pick<CollapsibleBuildEvent, "id">): CollapsibleBuildEvent {
  return {
    projectId: "blue",
    eventType: "meaningful_commit",
    timestamp: new Date("2026-08-28T12:00:00.000Z"),
    title: "Meaningful commit",
    description: "feat: one · score 8/10 · substantive_feature",
    sourceUrl: "https://github.com/example/commit/1",
    metadata: { score: 8, classification: "substantive_feature" },
    ...partial,
  };
}

describe("commitMessageFromDescription", () => {
  it("strips the score suffix from a raw commit event", () => {
    assert.equal(
      commitMessageFromDescription("feat: add x402 paywall · score 9/10 · substantive_feature"),
      "feat: add x402 paywall",
    );
  });

  it("ignores grouped summary lines", () => {
    assert.equal(
      commitMessageFromDescription("15 meaningful public commits recorded today · feature, integration"),
      null,
    );
  });
});

describe("collapseMeaningfulCommitsByDay", () => {
  it("keeps one card per project per day and preserves headlines", () => {
    const collapsed = collapseMeaningfulCommitsByDay([
      event({
        id: "a",
        description: "feat: add x402 paywall · score 9/10 · substantive_feature",
        metadata: { score: 9, classification: "substantive_feature" },
      }),
      event({
        id: "b",
        timestamp: new Date("2026-08-28T15:00:00.000Z"),
        description: "feat: wire MCP client · score 8/10 · SDK_API",
        metadata: { score: 8, classification: "SDK_API" },
      }),
      event({
        id: "c",
        timestamp: new Date("2026-08-28T18:00:00.000Z"),
        description: "fix: retry 402 payments · score 7/10 · substantive_fix",
        metadata: { score: 7, classification: "substantive_fix" },
      }),
    ]);
    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0]?.commitCount, 3);
    assert.equal(collapsed[0]?.event.id, "a");
    assert.deepEqual(collapsed[0]?.commitHeadlines, [
      "feat: add x402 paywall",
      "feat: wire MCP client",
      "fix: retry 402 payments",
    ]);
  });

  it("prefers a grouped build update over raw commits", () => {
    const collapsed = collapseMeaningfulCommitsByDay([
      event({
        id: "raw",
        metadata: { score: 9, classification: "substantive_feature" },
      }),
      event({
        id: "grouped",
        title: "Build update",
        description: "3 meaningful public commits recorded today · feature",
        metadata: {
          groupedBuildUpdate: true,
          commitCount: 3,
          score: 9,
          commitHeadlines: ["feat: grouped headline"],
        },
      }),
    ]);
    assert.equal(collapsed[0]?.event.id, "grouped");
    assert.equal(collapsed[0]?.commitCount, 3);
    assert.equal(collapsed[0]?.commitHeadlines[0], "feat: grouped headline");
  });
});

describe("buildSignalCopy", () => {
  it("uses the commit headline instead of a classification bucket", () => {
    const copy = buildSignalCopy(baseInput());
    assert.match(copy.whatHappened, /feat: add x402 paywall/);
    assert.doesNotMatch(copy.whatHappened, /^Public commit on 2026-08-28: product feature work/);
    assert.match(copy.whyItMayMatter, /AI founder console/);
    assert.doesNotMatch(copy.whyItMayMatter, /still showing public shipping activity/);
    assert.doesNotMatch(copy.tokenRelation, /mcap|liq/);
    assert.match(copy.tokenRelation, /migration/);
  });

  it("does not paste market stats into the relation line", () => {
    const copy = buildSignalCopy(baseInput({ commitCount: 15, commitHeadlines: ["a", "b", "c"] }));
    assert.match(copy.whatHappened, /15 public commits/);
    assert.doesNotMatch(copy.tokenRelation, /\$38\.5K/);
  });

  it("marks the stock caveat as generic so cards can hide it", () => {
    const copy = buildSignalCopy(baseInput({ projectStatus: "watch", classification: "substantive_feature" }));
    assert.equal(isGenericCaveat(copy), true);
  });
});
