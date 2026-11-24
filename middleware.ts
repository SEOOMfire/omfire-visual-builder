import { NextResponse, type NextRequest } from "next/server";

function webUiEnabled(): boolean {
  return process.env.ENABLE_WEB_UI === "true";
}

function isWebUiPath(path: string): boolean {
  return path === "/"
    || path === "/login"
    || path.startsWith("/visual-builder")
    || path.startsWith("/konto")
    || path.startsWith("/auth")
    || path.startsWith("/api/visual-builder")
    || path.startsWith("/api/auth")
    || path.startsWith("/api/account");
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = request.nextUrl.hostname;
  if (path.startsWith("/internal") && host !== "localhost" && host !== "127.0.0.1") {
    return new NextResponse(null, { status: 404 });
  }
  if (!webUiEnabled() && isWebUiPath(path)) {
    return new NextResponse(null, { status: 404 });
  }
  const loggedIn = Boolean(request.cookies.get("vb-session")?.value);
  if ((path.startsWith("/visual-builder") || path.startsWith("/konto")) && !loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (path === "/login" && loggedIn) {
    return NextResponse.redirect(new URL("/visual-builder", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/visual-builder/:path*", "/konto", "/login", "/auth/:path*", "/api/visual-builder/:path*", "/api/auth/:path*", "/api/account/:path*", "/internal/:path*"],
};
