import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // docs.clawbook.lol → /docs
  if (host.startsWith("docs.")) {
    const url = request.nextUrl.clone();
    if (url.pathname === "/") {
      url.pathname = "/docs";
      return NextResponse.rewrite(url);
    }
    // docs.clawbook.lol/anything → /docs/anything
    if (!url.pathname.startsWith("/docs")) {
      url.pathname = `/docs${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png).*)",
};
