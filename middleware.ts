import { NextResponse, type NextRequest } from "next/server"

const sessionCookieName =
  process.env.AUTH_SESSION_COOKIE_NAME?.trim() || "stocks_hunter_session"

function isPublicPath(pathname: string) {
  return pathname === "/login"
}

function isPublicApiPath(pathname: string) {
  return pathname === "/api/auth/login" || pathname === "/api/auth/logout"
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const sessionToken = request.cookies.get(sessionCookieName)?.value

  if (isPublicApiPath(pathname)) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    if (!sessionToken) return NextResponse.next()
    const url = request.nextUrl.clone()
    url.pathname = "/"
    url.search = ""
    return NextResponse.redirect(url)
  }

  if (sessionToken) {
    return NextResponse.next()
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 })
  }

  const url = request.nextUrl.clone()
  url.pathname = "/login"
  const nextPath = `${pathname}${search ?? ""}`
  url.searchParams.set("next", nextPath)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|autad-logo-white.png|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.webp$).*)",
  ],
}
