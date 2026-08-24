import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recencyBadge, slugify, isLikelyEvmAddress } from "./index";

describe("recencyBadge", () => {
  const now = new Date("2026-08-23T12:00:00Z");
  it("hot within 7 days", () => {
    assert.equal(recencyBadge(new Date("2026-08-20T12:00:00Z"), now), "hot");
  });
  it("dormant after 60 days", () => {
    assert.equal(recencyBadge(new Date("2026-05-01T12:00:00Z"), now), "dormant");
  });
  it("unknown when null", () => {
    assert.equal(recencyBadge(null, now), "unknown");
  });
});

describe("slugify", () => {
  it("normalizes names", () => {
    assert.equal(slugify("Hello World!"), "hello-world");
  });
});

describe("isLikelyEvmAddress", () => {
  it("accepts 0x + 40 hex", () => {
    assert.equal(isLikelyEvmAddress("0x" + "a".repeat(40)), true);
  });
  it("rejects short", () => {
    assert.equal(isLikelyEvmAddress("0xabc"), false);
  });
});
