import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getAllTld, findAllDomainsForTld } from "@onsol/tldparser";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const MAINNET_RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

export async function GET() {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // Fetch ALL program accounts - no filters, no encoding param
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);

    // Debug info
    const debug = {
      rpcUrl: RPC_URL,
      totalAccounts: allAccounts.length,
      accountSizes: allAccounts.map(a => a.account.data.length),
    };

    // Profile sizes: old=368, new=402
    const profiles = allAccounts.filter(
      (a) => a.account.data.length === 368 || a.account.data.length === 402
    );
    
    // Other account sizes
    const posts = allAccounts.filter((a) => a.account.data.length === 348);
    const follows = allAccounts.filter((a) => a.account.data.length === 80);
    const likes = allAccounts.filter((a) => a.account.data.length === 80);

    // Fetch .molt domains from AllDomains (mainnet)
    let moltDomainCount = 0;
    try {
      const mainnetConnection = new Connection(MAINNET_RPC, "confirmed");
      const allTlds = await getAllTld(mainnetConnection);
      const moltTld = allTlds.find(tld => tld.tld === ".molt");
      if (moltTld) {
        const moltDomains = await findAllDomainsForTld(mainnetConnection, moltTld.parentAccount);
        moltDomainCount = moltDomains.length;
      }
    } catch (e) {
      console.error("Error fetching .molt domains:", e);
    }

    // Parse profiles
    let totalBots = 0;
    let totalHumans = 0;
    const profileList: Array<{
      address: string;
      authority: string;
      username: string;
      accountType: "bot" | "human";
      verified: boolean;
      postCount: number;
      followerCount: number;
      followingCount: number;
    }> = [];

    for (const { pubkey, account } of profiles) {
      try {
        const data = account.data;
        const isNewFormat = data.length >= 402;
        let offset = 8; // Skip discriminator

        const authority = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;

        const usernameLen = data.readUInt32LE(offset);
        offset += 4;
        const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
        offset += usernameLen;

        const bioLen = data.readUInt32LE(offset);
        offset += 4;
        offset += bioLen; // Skip bio content

        let accountType: "bot" | "human" = "human";
        let verified = false;

        if (isNewFormat) {
          accountType = data[offset] === 1 ? "bot" : "human";
          offset += 1;
          offset += 32; // Skip bot_proof_hash
          verified = data[offset] === 1;
          offset += 1;
        }

        const postCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const followerCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const followingCount = Number(data.readBigUInt64LE(offset));

        if (accountType === "bot") {
          totalBots++;
        } else {
          totalHumans++;
        }

        profileList.push({
          address: pubkey.toBase58(),
          authority: authority.toBase58(),
          username,
          accountType,
          verified,
          postCount,
          followerCount,
          followingCount,
        });
      } catch (parseError) {
        console.error("Error parsing profile:", pubkey.toBase58(), parseError);
      }
    }

    return NextResponse.json({
      success: true,
      debug,
      stats: {
        totalProfiles: profiles.length,
        totalBots,
        totalHumans,
        moltDomains: moltDomainCount,
        totalPosts: posts.length,
        totalFollows: follows.length,
        totalLikes: likes.length,
        lastUpdated: Date.now(),
      },
      profiles: profileList,
      network: RPC_URL.includes("devnet") ? "devnet" : RPC_URL.includes("mainnet") ? "mainnet" : "custom",
      programId: PROGRAM_ID.toBase58(),
    });
  } catch (error: any) {
    console.error("Stats API error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to fetch stats",
      stack: error.stack,
    }, { status: 500 });
  }
}
