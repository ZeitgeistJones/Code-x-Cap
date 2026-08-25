import { getExpectedAdminKey, isAuthenticated } from "@/lib/auth";

/** Cookie unlock OR x-admin-key header/query (same rules as seed-research). */
export async function assertAdminApiAccess(request: Request): Promise<Response | null> {
  const expected = getExpectedAdminKey();
  const provided =
    request.headers.get("x-admin-key") ?? new URL(request.url).searchParams.get("key");
  const cookieOk = await isAuthenticated();
  const keyOk = Boolean(expected && provided === expected);
  const openDev = !expected && process.env.NODE_ENV === "development";

  if (!keyOk && !cookieOk && !openDev) {
    return Response.json({ error: "Unauthorized — unlock the site first" }, { status: 401 });
  }
  return null;
}
