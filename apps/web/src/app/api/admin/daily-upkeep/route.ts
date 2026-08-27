import { NextResponse } from "next/server";
import { assertAdminApiAccess } from "@/lib/admin-api-auth";
import { runDailyUpkeep } from "@/lib/runDailyUpkeep";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/admin/daily-upkeep — unlocked cookie or x-admin-key required. */
export async function POST(request: Request) {
  const denied = await assertAdminApiAccess(request);
  if (denied) return denied;

  try {
    return NextResponse.json(await runDailyUpkeep());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily upkeep failed";
    console.error("daily-upkeep failed", error);
    return NextResponse.json({ error: message.slice(0, 180) }, { status: 500 });
  }
}
