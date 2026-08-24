import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE = "cxc_admin";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const expected = process.env.ADMIN_KEY;
  // Without ADMIN_KEY in production, force unlock page with message via still requiring cookie match fail
  if (!expected) {
    if (process.env.NODE_ENV === "development") return NextResponse.next();
    if (pathname !== "/unlock") {
      return NextResponse.redirect(new URL("/unlock", request.url));
    }
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE)?.value;
  if (cookie !== expected) {
    return NextResponse.redirect(new URL("/unlock", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
