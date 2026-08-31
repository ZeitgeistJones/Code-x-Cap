"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface DailyUpkeepResponse {
  complete?: boolean;
  error?: string;
  jobRunId?: string;
  phase?: "refreshing" | "finalizing" | "explaining" | "complete";
  status?: string;
  progress?: {
    processed: number;
    total: number;
    githubProcessed: number;
    githubTotal: number;
    tokenProcessed: number;
    tokenTotal: number;
    explainProcessed?: number;
    explainTotal?: number;
  };
  github?: { processed: number; successful: number; failed: number };
  tokens?: { processed: number; successful: number; skipped: number; failed: number };
  newEventsCreated?: number;
  groupedBuildUpdatesCreated?: number;
  explanationsWritten?: number;
  errors?: string[];
}

export function DailyUpkeepButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setProgressText("Starting upkeep…");
    let activeJobRunId: string | undefined;

    try {
      for (let step = 0; step < 200; step += 1) {
        const response = await fetch("/api/admin/daily-upkeep", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(activeJobRunId ? { jobRunId: activeJobRunId } : {}),
        });
        const raw = await response.text();
        let result: DailyUpkeepResponse;
        try {
          result = JSON.parse(raw) as DailyUpkeepResponse;
        } catch {
          const timedOut = response.status === 504 || /timed?\s*out|task timeout/i.test(raw);
          window.alert(
            timedOut
              ? "This upkeep step reached Vercel’s time limit. Saved progress is intact. " +
                  "Click Run daily upkeep again to resume."
              : `Daily upkeep returned an unreadable server response (${response.status}). ` +
                  `${raw.replace(/\s+/g, " ").slice(0, 160) || "No response body."}`,
          );
          return;
        }

        if (!response.ok) {
          window.alert(result.error ?? `Daily upkeep failed (${response.status})`);
          return;
        }
        if (!result.jobRunId) {
          window.alert("Daily upkeep returned no job ID. Please try again.");
          return;
        }

        activeJobRunId = result.jobRunId;
        if (result.complete) {
          const errors =
            result.errors && result.errors.length > 0
              ? `\n\nIssues:\n${result.errors
                  .slice(0, 6)
                  .map((value) => `· ${value}`)
                  .join("\n")}`
              : "";
          window.alert(
            `Daily upkeep: ${result.status ?? "finished"}\n\n` +
              `GitHub — ${result.github?.successful ?? 0}/${result.github?.processed ?? 0} OK, ` +
              `${result.github?.failed ?? 0} failed\n` +
              `Markets — ${result.tokens?.successful ?? 0}/${result.tokens?.processed ?? 0} OK, ` +
              `${result.tokens?.skipped ?? 0} skipped, ${result.tokens?.failed ?? 0} failed\n` +
              `New events: ${result.newEventsCreated ?? 0}\n` +
              `Build updates: ${result.groupedBuildUpdatesCreated ?? 0}\n` +
              `Gemini explanations: ${result.explanationsWritten ?? 0}\n` +
              `Job: ${result.jobRunId}` +
              errors,
          );
          router.refresh();
          return;
        }

        const progress = result.progress;
        setProgressText(
          result.phase === "finalizing"
            ? "Finalizing upkeep…"
            : result.phase === "explaining"
              ? `Writing plain-English notes ${progress?.explainProcessed ?? 0}/${progress?.explainTotal ?? 0}…`
              : progress
                ? `Upkeep ${progress.processed}/${progress.total}…`
                : "Running upkeep…",
        );
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      window.alert(
        `Daily upkeep paused after too many steps. Click the button again to resume${
          activeJobRunId ? ` job ${activeJobRunId}` : ""
        }.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Daily upkeep request failed";
      window.alert(
        `${message}. Saved progress is intact${
          activeJobRunId ? ` for job ${activeJobRunId}` : ""
        }. Click Run daily upkeep again to resume.`,
      );
    } finally {
      setBusy(false);
      setProgressText(null);
    }
  }

  return (
    <button type="button" className="btn" onClick={run} disabled={busy}>
      {busy ? (progressText ?? "Running upkeep…") : "Run daily upkeep"}
    </button>
  );
}
