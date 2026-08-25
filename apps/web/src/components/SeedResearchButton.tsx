"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SeedResearchButton({
  label = "Load research seed",
  className = "btn",
}: {
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/seed-research", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as {
        error?: string;
        created?: string[];
        updated?: string[];
        errors?: Array<{ slug: string; error: string }>;
        count?: number;
        tokensWithCa?: number;
        tokensMissingCa?: number;
        missingCaSlugs?: string[];
      };

      if (!res.ok) {
        window.alert(data.error ?? `Seed failed (${res.status})`);
        return;
      }

      const created = data.created?.length ?? 0;
      const updated = data.updated?.length ?? 0;
      const failed = data.errors?.length ?? 0;
      const missing = data.errors?.map((e) => e.slug).join(", ");

      // CAs alone don't fill the table — pull markets next
      let marketLine = "\n\nMarkets: skipped (seed error)";
      if (failed === 0 || (data.tokensWithCa ?? 0) > 0) {
        try {
          const mRes = await fetch("/api/admin/refresh-markets", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const mData = (await mRes.json()) as {
            error?: string;
            refreshed?: number;
            succeeded?: number;
            withMcap?: number;
            failed?: number;
            failures?: Array<{ symbol: string | null; error: string }>;
          };
          if (!mRes.ok) {
            marketLine = `\n\nMarkets refresh failed: ${mData.error ?? mRes.status}`;
          } else {
            const fails =
              mData.failures && mData.failures.length > 0
                ? `\nFailed: ${mData.failures.map((f) => f.symbol ?? "?").join(", ")}`
                : "";
            marketLine =
              `\n\nMarkets refreshed.\n` +
              `Tried: ${mData.refreshed ?? 0}\n` +
              `OK: ${mData.succeeded ?? 0}\n` +
              `With mcap/FDV: ${mData.withMcap ?? 0}\n` +
              `Failed: ${mData.failed ?? 0}` +
              fails;
          }
        } catch (e) {
          marketLine = `\n\nMarkets refresh error: ${e instanceof Error ? e.message : "failed"}`;
        }
      }

      window.alert(
        `Research seed done.\nCreated: ${created}\nUpdated: ${updated}\nFailed: ${failed}` +
          (missing ? `\nFailed slugs: ${missing}` : "") +
          `\nTokens with CA now: ${data.tokensWithCa ?? "?"}` +
          `\nTokens still missing CA: ${data.tokensMissingCa ?? "?"}` +
          (data.missingCaSlugs?.length
            ? `\nMissing: ${data.missingCaSlugs.join(", ")}`
            : "") +
          `\nExpected projects: ${data.count ?? 17}` +
          marketLine,
      );
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Seed request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={busy}>
      {busy ? "Seeding + markets…" : label}
    </button>
  );
}
