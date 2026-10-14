import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "sleek_session"

// Public: the login page, the auth endpoints, and Stripe's webhook (which authenticates by signature instead).
const isPublic = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/api/auth/") || pathname.startsWith("/api/webhooks/")

/**
 * First line of defence only: requests with no session cookie never reach the app. Whether the session is actually
 * valid, and which role it has, is checked on the server by every page and API route (see src/server/auth.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!isPublic(pathname) && !request.cookies.has(SESSION_COOKIE)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in" }, { status: 401 })
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  // Tells the root layout which area is rendering so the admin styles are on <html> from the first byte (no flash).
  const headers = new Headers(request.headers)
  headers.set("x-sleek-area", pathname.startsWith("/admin") ? "admin" : "staff")
  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|brand|icon.png|apple-icon.png|favicon.ico).*)"],
}
