import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// A quick first check: without a session cookie, go straight to the login page.
// The real check (is the session valid, is the person active, what is their role) happens on the server in each page.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("zk_session");
  const open = request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/setup";
  if (!hasSession && !open) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|webmanifest)$).*)"],
};
