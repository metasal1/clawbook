import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { resolve, getAllDomains, reverseLookup } from "@bonfida/spl-name-service";

const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  const action = req.nextUrl.searchParams.get("action") || "lookup";

  if (action === "list") {
    // List all .molt.sol subdomains
    try {
      const connection = new Connection(MAINNET_RPC, "confirmed");
      // Resolve the parent molt.sol to get its key
      const parentOwner = await resolve(connection, "molt");

      return NextResponse.json({
        parent: "molt.sol",
        parentOwner: parentOwner.toBase58(),
        note: "Use lookup with ?domain=name to resolve specific subdomains",
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  // Clean input - accept "name", "name.molt", or "name.molt.sol"
  const cleanDomain = domain
    .toLowerCase()
    .replace(/\.sol$/, "")
    .replace(/\.molt$/, "");
  const fullDomain = `${cleanDomain}.molt`;
  const displayDomain = `${cleanDomain}.molt.sol`;

  try {
    const connection = new Connection(MAINNET_RPC, "confirmed");

    try {
      // resolve handles subdomains: resolve("sub.parent") resolves sub.parent.sol
      const owner = await resolve(connection, fullDomain);

      return NextResponse.json({
        domain: displayDomain,
        available: false,
        owner: owner.toBase58(),
      });
    } catch (e: any) {
      // Domain doesn't exist
      return NextResponse.json({
        domain: displayDomain,
        available: true,
      });
    }
  } catch (error: any) {
    console.error("SOL domain lookup error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
