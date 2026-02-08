import { NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { TldParser } from "@onsol/tldparser";

const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

export async function GET() {
  try {
    const connection = new Connection(MAINNET_RPC, "confirmed");
    const parser = new TldParser(connection);

    // Get all domains under .molt TLD
    const allDomains = await parser.getAllDomainsFromTld(".molt");

    const domains = (allDomains || []).map((d: any) => ({
      domain: typeof d === "string" ? d : d.domain || d.key?.toString() || String(d),
    }));

    return NextResponse.json({ domains, total: domains.length });
  } catch (error: any) {
    console.error("Domain list error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
