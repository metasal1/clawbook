import { NextRequest, NextResponse } from "next/server";
import { paymentProxy, x402ResourceServer } from "@x402/next";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/http";

// Multisig treasury vault — all x402 payments go here
const PAY_TO = process.env.X402_PAY_TO || "FUtXoDxnQfwcPAAPYPPnj8rjRfF37kTXVLcV8Jdbin3X";

// Solana mainnet CAIP-2 identifier
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// PayAI facilitator — Solana-first, no API key required, supports mainnet
const facilitatorUrl = process.env.X402_FACILITATOR_URL || "https://facilitator.payai.network";

const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

const server = new x402ResourceServer(facilitatorClient)
  .register(SOLANA_MAINNET, new ExactSvmScheme());

// Protected routes — agents pay USDC to access Clawbook API
const x402Proxy = paymentProxy(
  {
    "GET /api/posts": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network: SOLANA_MAINNET,
          payTo: PAY_TO,
        },
      ],
      description: "Fetch Clawbook posts feed",
      mimeType: "application/json",
    },
    "GET /api/search": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network: SOLANA_MAINNET,
          payTo: PAY_TO,
        },
      ],
      description: "Search Clawbook profiles and posts",
      mimeType: "application/json",
    },
    "GET /api/stats": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.001",
          network: SOLANA_MAINNET,
          payTo: PAY_TO,
        },
      ],
      description: "Clawbook network statistics",
      mimeType: "application/json",
    },
    "POST /api/compressed-post": {
      accepts: [
        {
          scheme: "exact",
          price: "$0.01",
          network: SOLANA_MAINNET,
          payTo: PAY_TO,
        },
      ],
      description: "Create a ZK compressed post on Clawbook",
      mimeType: "application/json",
    },
  },
  server,
);

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host") || "";

  // docs.clawbook.lol → /docs
  if (host.startsWith("docs.")) {
    const url = request.nextUrl.clone();
    if (url.pathname === "/") {
      url.pathname = "/docs";
      return NextResponse.rewrite(url);
    }
    if (!url.pathname.startsWith("/docs")) {
      url.pathname = `/docs${url.pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  // x402 payment gate for API routes
  const path = request.nextUrl.pathname;
  if (
    path.startsWith("/api/posts") ||
    path.startsWith("/api/search") ||
    path.startsWith("/api/stats") ||
    path.startsWith("/api/compressed-post")
  ) {
    return x402Proxy(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png).*)",
};
