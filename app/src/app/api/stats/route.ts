import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

// Account sizes (old program uses different sizes)
// Old Profile: 8 + 32 + (4+32) + (4+256) + 8 + 8 + 8 + 8 = 368 bytes
// New Profile: 368 + 1 (account_type) + 32 (proof_hash) + 1 (verified) = 402 bytes
const PROFILE_SIZE_OLD = 368;
const PROFILE_SIZE_NEW = 402;
const POST_SIZE = 348;
const FOLLOW_SIZE = 80;
const LIKE_SIZE = 80;

export async function GET() {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // Fetch all program accounts and categorize by size
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      encoding: "base64",
    });

    // Categorize by account size
    const profiles = allAccounts.filter(
      (a) => a.account.data.length === PROFILE_SIZE_OLD || a.account.data.length === PROFILE_SIZE_NEW
    );
    const posts = allAccounts.filter((a) => a.account.data.length === POST_SIZE);
    const follows = allAccounts.filter((a) => a.account.data.length === FOLLOW_SIZE);
    const likes = allAccounts.filter((a) => a.account.data.length === LIKE_SIZE);

    // Parse profiles to count bots vs humans
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
      const data = account.data;
      const isNewFormat = data.length >= PROFILE_SIZE_NEW;
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
        // New format has account_type, proof_hash, verified
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
    }

    return NextResponse.json({
      success: true,
      stats: {
        totalProfiles: profiles.length,
        totalBots,
        totalHumans,
        totalPosts: posts.length,
        totalFollows: follows.length,
        totalLikes: likes.length,
        lastUpdated: Date.now(),
      },
      profiles: profileList,
      network: RPC_URL.includes("devnet") ? "devnet" : RPC_URL.includes("mainnet") ? "mainnet" : "custom",
      programId: PROGRAM_ID.toBase58(),
    });
  } catch (error) {
    console.error("Stats API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
