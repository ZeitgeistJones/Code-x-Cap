import { NextResponse } from "next/server";
import { assertAdminApiAccess } from "@/lib/admin-api-auth";
import { runDailyUpkeepStep } from "@/lib/runDailyUpkeep";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/admin/daily-upkeep — unlocked cookie or x-admin-key required. */
export async function POST(request: Request) {
  const denied = await assertAdminApiAccess(request);
  if (denied) return denied;

  try {
    const raw = await request.text();
    let jobRunId: string | undefined;
    if (raw.trim()) {
      const body: unknown = JSON.parse(raw);
      if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
      }
      const candidate = (body as Record<string, unknown>).jobRunId;
      if (candidate != null && typeof candidate !== "string") {
        return NextResponse.json({ error: "jobRunId must be a string" }, { status: 400 });
      }
      if (typeof candidate === "string") jobRunId = candidate;
    }

    const result = await runDailyUpkeepStep(jobRunId);
    return NextResponse.json(result, { status: result.complete ? 200 : 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily upkeep failed";
    console.error("daily-upkeep failed", error);
    return NextResponse.json({ error: message.slice(0, 180) }, { status: 500 });
  }
}
