import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

// Account sizes
const PROFILE_SIZE = 402;
const POST_SIZE = 348;
const FOLLOW_SIZE = 80;
const LIKE_SIZE = 80;

export async function GET() {
  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // Fetch all account types in parallel
    const [profiles, posts, follows, likes] = await Promise.all([
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: PROFILE_SIZE }],
        dataSlice: { offset: 0, length: 402 }, // Get full profile to check type
      }),
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: POST_SIZE }],
        dataSlice: { offset: 0, length: 0 }, // Just count, no data needed
      }),
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: FOLLOW_SIZE }],
        dataSlice: { offset: 0, length: 0 },
      }),
      connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: LIKE_SIZE }],
        dataSlice: { offset: 0, length: 0 },
      }),
    ]);

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

      const accountType = data[offset] === 1 ? "bot" : "human";
      offset += 1;

      offset += 32; // Skip bot_proof_hash

      const verified = data[offset] === 1;
      offset += 1;

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
