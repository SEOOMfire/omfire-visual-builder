import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const loggedIn = Boolean(request.cookies.get("vb-session")?.value);
  const path = request.nextUrl.pathname;
  if (path.startsWith("/visual-builder") && !loggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (path === "/login" && loggedIn) {
    return NextResponse.redirect(new URL("/visual-builder", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/visual-builder/:path*", "/login"] };
