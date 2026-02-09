import { NextRequest, NextResponse } from "next/server";

/**
 * Basic auth middleware for staging protection.
 * Set STAGING_AUTH_USER and STAGING_AUTH_PASS env vars to enable.
 * Remove or leave the env vars unset to disable (e.g., in production).
 */
export function middleware(request: NextRequest) {
  const user = process.env.STAGING_AUTH_USER;
  const pass = process.env.STAGING_AUTH_PASS;

  // No credentials configured — skip auth (production mode)
  if (!user || !pass) return NextResponse.next();

  // Don't gate API routes (needed for GraphQL proxy, webhooks, etc.)
  if (request.nextUrl.pathname.startsWith("/api/")) return NextResponse.next();

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [u, p] = decoded.split(":");
      if (u === user && p === pass) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Staging"',
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
