import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const host = request.nextUrl.hostname;
  if ((path.startsWith("/internal") || path.startsWith("/api/internal")) && host !== "localhost" && host !== "127.0.0.1") {
    return new NextResponse(null, { status: 404 });
  }
  const loggedIn = Boolean(request.cookies.get("vb-session")?.value);
  if (path.startsWith("/visual-builder") && !loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (path === "/login" && loggedIn) {
    return NextResponse.redirect(new URL("/visual-builder", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/visual-builder/:path*", "/login", "/internal/:path*", "/api/internal/:path*"] };
