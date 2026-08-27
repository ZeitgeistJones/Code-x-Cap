"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DailyUpkeepResponse {
  error?: string;
  jobRunId?: string;
  status?: string;
  github?: { processed: number; successful: number; failed: number };
  tokens?: { processed: number; successful: number; skipped: number; failed: number };
  newEventsCreated?: number;
  groupedBuildUpdatesCreated?: number;
  errors?: string[];
}

export function DailyUpkeepButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/daily-upkeep", {
        method: "POST",
        credentials: "include",
      });
      const raw = await response.text();
      let result: DailyUpkeepResponse;
      try {
        result = JSON.parse(raw) as DailyUpkeepResponse;
      } catch {
        const timedOut = response.status === 504 || /timed?\s*out|task timeout/i.test(raw);
        window.alert(
          timedOut
            ? "Daily upkeep reached Vercel’s time limit. Completed refresh records were preserved. " +
                "The next run will close the interrupted job record."
            : `Daily upkeep returned an unreadable server response (${response.status}). ` +
                `${raw.replace(/\s+/g, " ").slice(0, 160) || "No response body."}`,
        );
        return;
      }
      if (!response.ok) {
        window.alert(result.error ?? `Daily upkeep failed (${response.status})`);
        return;
      }

      const errors =
        result.errors && result.errors.length > 0
          ? `\n\nIssues:\n${result.errors.slice(0, 6).map((value) => `· ${value}`).join("\n")}`
          : "";
      window.alert(
        `Daily upkeep: ${result.status ?? "finished"}\n\n` +
          `GitHub — ${result.github?.successful ?? 0}/${result.github?.processed ?? 0} OK, ` +
          `${result.github?.failed ?? 0} failed\n` +
          `Markets — ${result.tokens?.successful ?? 0}/${result.tokens?.processed ?? 0} OK, ` +
          `${result.tokens?.skipped ?? 0} skipped, ${result.tokens?.failed ?? 0} failed\n` +
          `New events: ${result.newEventsCreated ?? 0}\n` +
          `Build updates: ${result.groupedBuildUpdatesCreated ?? 0}\n` +
          `Job: ${result.jobRunId ?? "unknown"}` +
          errors,
      );
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Daily upkeep request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="btn" onClick={run} disabled={busy}>
      {busy ? "Running upkeep…" : "Run daily upkeep"}
    </button>
  );
}
