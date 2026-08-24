import { cookies } from "next/headers";

const COOKIE_NAME = "cxc_admin";

export function getExpectedAdminKey(): string | undefined {
  return process.env.ADMIN_KEY;
}

export async function isAuthenticated(): Promise<boolean> {
  const expected = getExpectedAdminKey();
  if (!expected) {
    // Dev convenience: if no key configured, allow access but warn in UI
    return process.env.NODE_ENV === "development";
  }
  const jar = await cookies();
  return jar.get(COOKIE_NAME)?.value === expected;
}

export function adminCookieName(): string {
  return COOKIE_NAME;
}

export function requireAdminKeyFromForm(formKey: string | null | undefined): boolean {
  const expected = getExpectedAdminKey();
  if (!expected) return process.env.NODE_ENV === "development";
  return formKey === expected;
}
