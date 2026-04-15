import { NextRequest, NextResponse } from "next/server";

const MAX_COOKIE_HEADER_SIZE = 8192; // 8KB - well under Vercel's limit

export function middleware(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie") || "";

  if (cookieHeader.length > MAX_COOKIE_HEADER_SIZE) {
    // Cookies are too large — clear all auth cookies to force a fresh login
    const response = NextResponse.redirect(new URL("/", request.url));
    const cookieNames = cookieHeader
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter((name) => name.startsWith("__Secure-next-auth") || name.startsWith("next-auth"));

    for (const name of cookieNames) {
      response.cookies.set(name, "", {
        path: "/",
        expires: new Date(0),
        secure: true,
        httpOnly: true,
        sameSite: "none",
      });
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  // Exclude static assets and auth callback routes (Apple Sign-In POSTs here)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
