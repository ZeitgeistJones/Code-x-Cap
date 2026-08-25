import { NextResponse } from "next/server";
import { assertAdminApiAccess } from "@/lib/admin-api-auth";
import { refreshAllGithub, refreshProjectGithub } from "@/lib/github";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/refresh-github
 * Auth: admin cookie OR x-admin-key.
 * Body optional: { projectId?: string }
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

    const results = projectId
      ? await refreshProjectGithub(projectId)
      : await refreshAllGithub();

    const succeeded = results.filter((r) => r.ok);
    const failed = results.filter((r) => !r.ok);

    return NextResponse.json({
      ok: true,
      refreshed: results.length,
      succeeded: succeeded.length,
      failed: failed.length,
      results,
      failures: failed.map((r) => ({
        repo: r.fullName,
        error: r.error ?? "failed",
      })),
    });  } catch (e) {
    const message = e instanceof Error ? e.message : "refresh failed";
    console.error("refresh-github failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
