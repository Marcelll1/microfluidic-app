import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "session_token";

// stránky ktoré vyžadujú login
const PROTECTED_PREFIXES = ["/projects", "/editor", "/dashboard"];

// admin sekcia
const ADMIN_PREFIX = "/admin";

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // nechaj prejsť statické a api
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);

  // public povolené
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.next();
  }

  // editor bez project = demo povolené aj bez login
  if (pathname.startsWith("/editor") && !searchParams.get("project")) {
    return NextResponse.next();
  }

  // chránené stránky – vyžadujú cookie
  if (isProtectedPath(pathname) || pathname.startsWith(ADMIN_PREFIX)) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // admin kontrola
  if (pathname.startsWith(ADMIN_PREFIX)) {
    try {
      const meUrl = new URL("/api/auth/me", req.url);
      const res = await fetch(meUrl, {
        headers: {
          cookie: req.headers.get("cookie") ?? "",
        },
      });

      if (!res.ok) {
        const url = req.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }

      const me = await res.json();
      if (me.role !== "admin") {
        const url = req.nextUrl.clone();
        url.pathname = "/projects";
        return NextResponse.redirect(url);
      }
    } catch {
      const url = req.nextUrl.clone();
      url.pathname = "/projects";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
