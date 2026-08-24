import { NextResponse } from "next/server";
import { seedResearchProjects } from "@codexcap/db";
import { getExpectedAdminKey, isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/seed-research
 * Auth: x-admin-key header/query OR unlocked admin cookie.
 * Idempotent upsert of the full research pack (~17 projects).
 */
export async function POST(request: Request) {
  const expected = getExpectedAdminKey();
  const provided =
    request.headers.get("x-admin-key") ??
    new URL(request.url).searchParams.get("key");
  const cookieOk = await isAuthenticated();
  const keyOk = Boolean(expected && provided === expected);
  const openDev = !expected && process.env.NODE_ENV === "development";

  if (!keyOk && !cookieOk && !openDev) {
    return NextResponse.json({ error: "Unauthorized — unlock the site first" }, { status: 401 });
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
