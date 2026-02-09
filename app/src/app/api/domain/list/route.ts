import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAllTld,
  findAllDomainsForTld,
  NameRecordHeader,
  TldParser,
} from "@onsol/tldparser";

const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

export async function GET() {
  try {
    const connection = new Connection(MAINNET_RPC, "confirmed");
    const parser = new TldParser(connection);

    // Find .molt TLD
    const allTlds = await getAllTld(connection);
    const moltTld = allTlds.find((tld) => tld.tld === ".molt");

    if (!moltTld) {
      return NextResponse.json({ domains: [], total: 0 });
    }

    // Get the TLD parent account's owner (needed for reverse lookup)
    const parentRecord = await NameRecordHeader.fromAccountAddress(
      connection,
      moltTld.parentAccount
    );

    if (!parentRecord?.owner) {
      return NextResponse.json({ domains: [], total: 0 });
    }

    // Get all domain account keys under .molt
    const domainAccountKeys = await findAllDomainsForTld(
      connection,
      moltTld.parentAccount
    );

    // Reverse lookup each domain name using the parent owner
    const domains: {
      domain: string;
      owner: string;
      expiresAt: string;
    }[] = [];

    for (const key of domainAccountKeys) {
      try {
        const name = await parser.reverseLookupNameAccount(
          key,
          parentRecord.owner
        );
        const record = await NameRecordHeader.fromAccountAddress(
          connection,
          key
        );

        if (name) {
          domains.push({
            domain: name + ".molt",
            owner: record?.owner?.toBase58() || "unknown",
            expiresAt: record?.expiresAt?.toISOString() || "",
          });
        }
      } catch {
        // Skip domains that can't be resolved
      }
    }

    return NextResponse.json({
      domains: domains.sort((a, b) => a.domain.localeCompare(b.domain)),
      total: domains.length,
    });
  } catch (error: any) {
    console.error("Domain list error:", error);
    return NextResponse.json({ domains: [], total: 0, error: error.message });
  }
}
