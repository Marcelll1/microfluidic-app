import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const token = req.cookies.get("session_token")?.value;

  const path = url.pathname;

  // chránené stránky vyžadujú session cookie
  const protectedPaths = ["/projects", "/admin", "/dashboard"];
  const isProtected = protectedPaths.some((p) => path === p || path.startsWith(p + "/"));

  if (isProtected && !token) {
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/projects/:path*", "/admin/:path*", "/dashboard/:path*"],
};
