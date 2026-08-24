import { NextResponse } from "next/server";
import { getExpectedAdminKey } from "@/lib/auth";
import { refreshAllCurrentTokenMarkets } from "@/lib/market";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/admin/refresh-markets  Header: x-admin-key */
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
    const results = await refreshAllCurrentTokenMarkets();
    return NextResponse.json({
      ok: true,
      refreshed: results.length,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh failed";
    console.error("refresh-markets failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
