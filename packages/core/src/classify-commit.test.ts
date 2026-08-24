import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyCommit } from "./classify-commit";

describe("classifyCommit", () => {
  it("marks README-only as not meaningful", () => {
    const r = classifyCommit({
      title: "docs: typo",
      changedPaths: ["README.md"],
      additions: 2,
      deletions: 1,
    });
    assert.equal(r.classification, "README_only");
    assert.equal(r.isMeaningful, false);
  });

  it("marks lockfile-only as dependency_update", () => {
    const r = classifyCommit({
      title: "chore: bump",
      changedPaths: ["pnpm-lock.yaml"],
      additions: 100,
      deletions: 80,
    });
    assert.equal(r.classification, "dependency_update");
    assert.equal(r.isMeaningful, false);
  });

  it("scores contract work highly", () => {
    const r = classifyCommit({
      title: "feat: add escrow",
      changedPaths: ["contracts/Escrow.sol", "test/Escrow.t.sol"],
      additions: 120,
      deletions: 10,
    });
    assert.equal(r.classification, "contract_work");
    assert.ok(r.isMeaningful);
    assert.ok(r.meaningfulScore >= 5);
  });

  it("scores source feature as meaningful", () => {
    const r = classifyCommit({
      title: "feat: payment endpoint",
      changedPaths: ["src/api/payments.ts", "src/lib/x402.ts"],
      additions: 80,
      deletions: 5,
    });
    assert.ok(r.isMeaningful);
    assert.ok(["substantive_feature", "SDK_API"].includes(r.classification));
  });

  it("flags bot authors", () => {
    const r = classifyCommit({
      title: "Bump lodash",
      author: "dependabot[bot]",
      changedPaths: ["package.json", "src/index.ts"],
      additions: 2,
      deletions: 2,
    });
    assert.equal(r.isMeaningful, false);
  });
});
