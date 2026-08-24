import { NextResponse } from "next/server";
import { getExpectedAdminKey } from "@/lib/auth";
import { refreshAllGithub } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/admin/refresh-github  Header: x-admin-key */
export async function POST(request: Request) {
  const expected = getExpectedAdminKey();
  if (!expected) {
    return NextResponse.json({ error: "ADMIN_KEY not configured" }, { status: 500 });
  }
  const provided =
    request.headers.get("x-admin-key") ?? new URL(request.url).searchParams.get("key");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await refreshAllGithub();
    return NextResponse.json({
      ok: true,
      refreshed: results.length,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh failed";
    console.error("refresh-github failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
