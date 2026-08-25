"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type GithubRefreshResponse = {
  error?: string;
  refreshed?: number;
  succeeded?: number;
  failed?: number;
  failures?: Array<{ repo: string; error: string }>;
};

export function RefreshGithubButton({
  label = "Refresh GitHub",
  busyLabel = "Refreshing GitHub…",
  projectId,
  className = "btn",
}: {
  label?: string;
  busyLabel?: string;
  projectId?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/refresh-github", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { projectId } : {}),
      });
      const data = (await res.json()) as GithubRefreshResponse;

      if (!res.ok) {
        window.alert(data.error ?? `GitHub refresh failed (${res.status})`);
        return;
      }

      const failLines =
        data.failures && data.failures.length > 0
          ? `\n\nFailed:\n${data.failures
              .slice(0, 8)
              .map((f) => `· ${f.repo}: ${f.error}`)
              .join("\n")}${data.failures.length > 8 ? "\n…" : ""}`
          : "";

      window.alert(
        `GitHub refreshed.\n` +
          `Repos: ${data.refreshed ?? 0}\n` +
          `OK: ${data.succeeded ?? 0}\n` +
          `Failed: ${data.failed ?? 0}` +
          failLines,
      );
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "GitHub refresh request failed");
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
