import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getAllTld,
  findAllDomainsForTld,
  NameRecordHeader,
  TldParser,
  getDomainKey,
} from "@onsol/tldparser";

const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

// Known .molt domains - maintained as a fallback since reverse lookup
// doesn't reliably resolve domain names from account keys
const KNOWN_DOMAINS = ["solana", "metasal", "clawbook"];

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

    // Get all domain account keys under .molt
    const domainAccountKeys = await findAllDomainsForTld(
      connection,
      moltTld.parentAccount
    );

    // Build a map of account key -> domain info
    const accountKeySet = new Set(domainAccountKeys.map((k) => k.toBase58()));

    // Try to match known domains to on-chain accounts
    const resolvedDomains: {
      domain: string;
      owner: string;
      expiresAt: string;
    }[] = [];

    for (const name of KNOWN_DOMAINS) {
      try {
        const result = await getDomainKey(name + ".molt");
        const keyStr = result.pubkey
          ? result.pubkey.toBase58()
          : (result as any).toBase58();

        if (accountKeySet.has(keyStr)) {
          // Get owner info
          const accountKey = result.pubkey || (result as any);
          const record = await NameRecordHeader.fromAccountAddress(
            connection,
            accountKey
          );
          if (record) {
            resolvedDomains.push({
              domain: name + ".molt",
              owner: record.owner?.toBase58() || "unknown",
              expiresAt: record.expiresAt?.toISOString() || "",
            });
          }
          accountKeySet.delete(keyStr);
        }
      } catch {
        // Domain key derivation failed, skip
      }
    }

    // Any remaining unresolved accounts
    const unresolvedCount = accountKeySet.size;

    return NextResponse.json({
      domains: resolvedDomains,
      total: domainAccountKeys.length,
      resolved: resolvedDomains.length,
      unresolved: unresolvedCount,
    });
  } catch (error: any) {
    console.error("Domain list error:", error);
    return NextResponse.json({ domains: [], total: 0, error: error.message });
  }
}
