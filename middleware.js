import { NextResponse } from "next/server";

/**
 * Simple auth middleware:
 * - Allows public assets, _next, and API routes.
 * - Redirects to /login when no "token" cookie is present.
 * - Preserves original path in `from` query param so login can redirect back.
 */
function decodeJwtRole(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    // Convert base64url -> base64 and pad
    let base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);

    let jsonStr;
    if (typeof atob === "function") {
      jsonStr = atob(base64);
    } else if (typeof Buffer !== "undefined") {
      jsonStr = Buffer.from(base64, "base64").toString("utf-8");
    } else {
      return null;
    }

    const json = JSON.parse(jsonStr);
    return (json?.role || json?.user?.role || "").toLowerCase();
  } catch (_) {
    return null;
  }
}

function isAllowedPath(pathname, allowedPrefixes) {
  return allowedPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/") );
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public") ||
  pathname === "/login"
  ) {
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get("token");
  const token = tokenCookie?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Determine role from JWT (without verifying signature; server routes must still verify)
  const role = decodeJwtRole(token);

  // Define allowed paths per role
  const superadminAllowed = ["/login", "/dashboard", "/dashboard-admin", "/dashboard-superadmin", "/product", "/profile", "/checkout"]; 
  const adminAllowed = ["/login", "/dashboard", "/dashboard-admin", "/product", "/profile", "/checkout"]; 
  const userAllowed = ["/login", "/dashboard", "/product", "/profile", "/checkout"]; 

  let allowed = false;
  if (role === "superadmin") {
    allowed = isAllowedPath(pathname, superadminAllowed);
    if (!allowed) {
  const url = new URL("/dashboard-admin", request.url);
      return NextResponse.redirect(url);
    }
  } else if (role === "admin") {
    allowed = isAllowedPath(pathname, adminAllowed);
    if (!allowed) {
      const url = new URL("/dashboard-admin", request.url);
      return NextResponse.redirect(url);
    }
  } else if (role === "user") {
    allowed = isAllowedPath(pathname, userAllowed);
    if (!allowed) {
      const url = new URL("/dashboard", request.url);
      return NextResponse.redirect(url);
    }
  } else {
    // Unknown role: treat as not logged in -> to /login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Apply middleware to all routes (you can narrow this if needed)
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};