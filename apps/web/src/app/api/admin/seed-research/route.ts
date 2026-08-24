import { NextResponse } from "next/server";
import { seedResearchProjects } from "@codexcap/db";
import { getExpectedAdminKey } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed-research
 * Header: x-admin-key: <ADMIN_KEY>
 * Idempotent — skips slugs that already exist.
 */
export async function POST(request: Request) {
  const expected = getExpectedAdminKey();
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_KEY not configured" }, { status: 500 });
  }
  const provided =
    request.headers.get("x-admin-key") ??
    new URL(request.url).searchParams.get("key");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await seedResearchProjects();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Seed failed";
    console.error("seed-research failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
