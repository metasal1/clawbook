import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getAllTld, findAllDomainsForTld, NameRecordHeader, TldParser } from "@onsol/tldparser";

const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

export async function GET() {
  try {
    const connection = new Connection(MAINNET_RPC, "confirmed");
    const parser = new TldParser(connection);
    
    // Find .molt TLD
    const allTlds = await getAllTld(connection);
    const moltTld = allTlds.find(tld => tld.tld === ".molt");
    
    if (!moltTld) {
      return NextResponse.json({
        success: false,
        error: ".molt TLD not found",
      }, { status: 404 });
    }
    
    // Get all .molt domains
    const moltDomainAccounts = await findAllDomainsForTld(connection, moltTld.parentAccount);
    
    // Resolve domain names
    const domains: string[] = [];
    const parentNameRecord = await NameRecordHeader.fromAccountAddress(connection, moltTld.parentAccount);
    
    if (parentNameRecord && parentNameRecord.owner) {
      for (const domainAccount of moltDomainAccounts) {
        try {
          const domain = await parser.reverseLookupNameAccount(domainAccount, parentNameRecord.owner);
          if (domain) {
            domains.push(`${domain}.molt`);
          }
        } catch (e) {
          // Skip domains that can't be resolved
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      count: domains.length,
      domains: domains.sort(),
      tld: ".molt",
      parentAccount: moltTld.parentAccount.toBase58(),
      registry: "https://alldomains.id/buy-domain?tld=molt",
      lastUpdated: Date.now(),
    });
  } catch (error: any) {
    console.error("Molt domains API error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to fetch .molt domains",
    }, { status: 500 });
  }
}
