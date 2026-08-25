import { NextResponse } from "next/server";
import { tokens } from "@codexcap/db/schema";
import { eq } from "drizzle-orm";
import { assertAdminApiAccess } from "@/lib/admin-api-auth";
import { db } from "@/lib/db";
import { refreshAllCurrentTokenMarkets, refreshTokenMarket } from "@/lib/market";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/refresh-markets
 * Auth: admin cookie OR x-admin-key.
 * Body optional: { projectId?: string } — refresh one project’s tokens; else all current CAs.
 */
export async function POST(request: Request) {
  const denied = await assertAdminApiAccess(request);
  if (denied) return denied;

  try {
    let projectId: string | undefined;
    try {
      const body = (await request.json()) as { projectId?: string };
      projectId = body.projectId?.trim() || undefined;
    } catch {
      // empty body = refresh all
    }

    let results;
    if (projectId) {
      const rows = await db().select().from(tokens).where(eq(tokens.projectId, projectId));
      results = [];
      for (const t of rows) {
        if (!t.contractAddress) {
          results.push({
            tokenId: t.id,
            symbol: t.symbol,
            ok: false,
            marketCap: null,
            liquidityUsd: null,
            volume24h: null,
            error: "no contract address",
          });
          continue;
        }
        results.push(await refreshTokenMarket(t.id));
      }
    } else {
      results = await refreshAllCurrentTokenMarkets();
    }

    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const withMcap = ok.filter((r) => r.marketCap != null);

    return NextResponse.json({
      ok: true,
      refreshed: results.length,
      succeeded: ok.length,
      failed: failed.length,
      withMcap: withMcap.length,
      results,
      failures: failed.map((r) => ({
        symbol: r.symbol,
        error: r.error ?? "failed",
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh failed";
    console.error("refresh-markets failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
