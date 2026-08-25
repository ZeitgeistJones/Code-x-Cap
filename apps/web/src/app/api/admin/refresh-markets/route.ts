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
    let skippedNoCa: Array<{ symbol: string | null; projectName: string | null }> = [];

    if (projectId) {
      const rows = await db().select().from(tokens).where(eq(tokens.projectId, projectId));
      results = [];
      for (const t of rows) {
        if (!t.contractAddress) {
          skippedNoCa.push({ symbol: t.symbol, projectName: null });
          continue;
        }
        results.push(await refreshTokenMarket(t.id));
      }
    } else {
      const summary = await refreshAllCurrentTokenMarkets();
      results = summary.results;
      skippedNoCa = summary.skippedNoCa;
    }

    const ok = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);
    const withMcap = ok.filter((r) => r.marketCap != null);

    return NextResponse.json({
      ok: true,
      // "Tried" = tokens with a CA we actually fetched
      refreshed: results.length,
      succeeded: ok.length,
      failed: failed.length,
      withMcap: withMcap.length,
      skippedNoCa: skippedNoCa.length,
      skipped: skippedNoCa,
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
