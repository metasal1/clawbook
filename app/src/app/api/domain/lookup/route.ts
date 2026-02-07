import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { TldParser } from "@onsol/tldparser";

const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  // Clean input - remove .molt if included
  const cleanDomain = domain.toLowerCase().replace(/\.molt$/, "");
  const fullDomain = `${cleanDomain}.molt`;

  try {
    const connection = new Connection(MAINNET_RPC, "confirmed");
    const parser = new TldParser(connection);

    // Try to resolve the domain to find owner
    try {
      const owner = await parser.getOwnerFromDomainTld(fullDomain);
      
      if (owner) {
        const ownerStr = typeof owner === 'string' ? owner : owner.toBase58();
        return NextResponse.json({
          domain: fullDomain,
          available: false,
          owner: ownerStr,
        });
      }
    } catch (e) {
      // Domain doesn't exist, check price
    }

    // Domain not found - check price via AllDomains API
    const checkRes = await fetch(`https://alldomains.id/api/check-domain/${fullDomain}`);
    const checkData = await checkRes.json();

    return NextResponse.json({
      domain: fullDomain,
      available: true,
      price: checkData.domainPrice,
    });
  } catch (error: any) {
    console.error("Domain lookup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
