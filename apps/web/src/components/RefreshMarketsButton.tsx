"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MarketRefreshResponse = {
  error?: string;
  refreshed?: number;
  succeeded?: number;
  failed?: number;
  withMcap?: number;
  skippedNoCa?: number;
  skipped?: Array<{ symbol: string | null; projectName: string | null }>;
  failures?: Array<{ symbol: string | null; error: string }>;
};

export function RefreshMarketsButton({
  label = "Refresh markets",
  busyLabel = "Refreshing markets…",
  projectId,
  className = "btn",
}: {
  label?: string;
  busyLabel?: string;
  /** If set, only refresh this project’s tokens */
  projectId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/refresh-markets", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = (await res.json()) as MarketRefreshResponse;

      if (!res.ok) {
        window.alert(data.error ?? `Market refresh failed (${res.status})`);
        return;
      }

      const skipNames =
        data.skipped && data.skipped.length > 0
          ? data.skipped
              .map((s) => s.projectName ?? s.symbol ?? "?")
              .slice(0, 10)
              .join(", ")
          : "";

      const failLines =
        data.failures && data.failures.length > 0
          ? `\n\nFailed (have CA, no usable pool/data):\n${data.failures
              .slice(0, 8)
              .map((f) => `· ${f.symbol ?? "?"}: ${f.error}`)
              .join("\n")}${data.failures.length > 8 ? "\n…" : ""}`
          : "";

      const skipLine =
        (data.skippedNoCa ?? 0) > 0
          ? `\n\nSkipped — no contract address (${data.skippedNoCa}):\n${skipNames}${
              (data.skipped?.length ?? 0) > 10 ? "…" : ""
            }\n(These stay blank until you add a verified CA.)`
          : "";

      window.alert(
        `Markets refreshed.\n\n` +
          `Tokens with CA tried: ${data.refreshed ?? 0}\n` +
          `OK: ${data.succeeded ?? 0}\n` +
          `With mcap/FDV: ${data.withMcap ?? 0}\n` +
          `Failed: ${data.failed ?? 0}` +
          failLines +
          skipLine +
          `\n\nNote: this is not “all projects” — only rows with a contract address can have market data.`,
      );
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Market refresh request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={onClick} disabled={busy}>
      {busy ? busyLabel : label}
    </button>
  );
}
