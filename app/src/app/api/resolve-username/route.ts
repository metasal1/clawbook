import { PROGRAM_ID } from "@/lib/constants";
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
const PROFILE_SIZES = [368, 402, 534];

/**
 * Resolve a username to a wallet address (authority).
 * Used by the profile page to support /profile/<username> URLs.
 *
 * Tries Turso DB first, falls back to on-chain scan.
 *
 * GET /api/resolve-username?username=solanabot
 * Returns: { success: true, authority: "9WxZX3..." } or 404
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json(
      { success: false, error: "Missing username parameter" },
      { status: 400 }
    );
  }

  // Try Turso DB first
  try {
    const { getDb } = await import("@/lib/db");
    const db = getDb();

    const result = await db.execute({
      sql: `SELECT authority, address, username, pfp, account_type, verified
            FROM profiles
            WHERE LOWER(username) = LOWER(?)
            LIMIT 1`,
      args: [username],
    });

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return NextResponse.json({
        success: true,
        authority: row.authority,
        address: row.address,
        username: row.username,
        pfp: row.pfp,
        accountType: row.account_type,
        verified: Boolean(row.verified),
      });
    }
  } catch {
    // Turso not available or query failed, fall through to on-chain
  }

  // Fallback: scan on-chain profiles
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
      filters: PROFILE_SIZES.map(size => ({ dataSize: size })).slice(0, 1),
    });

    // getProgramAccounts with multiple dataSize filters doesn't work — fetch all sizes
    const accounts = [];
    for (const size of PROFILE_SIZES) {
      const batch = await connection.getProgramAccounts(PROGRAM_ID, {
        filters: [{ dataSize: size }],
      });
      accounts.push(...batch);
    }

    for (const { pubkey, account } of accounts) {
      const data = account.data;
      const size = data.length;
      const isV3 = size === 534;
      let offset = 8;

      const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
      offset += 32;

      const usernameLen = data.readUInt32LE(offset);
      offset += 4;
      const foundUsername = data.subarray(offset, offset + usernameLen).toString("utf-8");
      offset += usernameLen;

      if (foundUsername.toLowerCase() === username.toLowerCase()) {
        const bioLen = data.readUInt32LE(offset);
        offset += 4;
        const bio = data.subarray(offset, offset + bioLen).toString("utf-8");
        offset += bioLen;

        let pfp = "";
        if (isV3) {
          const pfpLen = data.readUInt32LE(offset);
          offset += 4;
          pfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
          offset += pfpLen;
        }

        let accountType = "human";
        let verified = false;
        const remaining = data.length - offset;
        if (remaining >= 66) {
          accountType = data[offset] === 1 ? "bot" : "human";
          offset += 33;
          verified = data[offset] === 1;
        }

        return NextResponse.json({
          success: true,
          authority,
          address: pubkey.toBase58(),
          username: foundUsername,
          pfp,
          accountType,
          verified,
          source: "onchain",
        });
      }
    }

    return NextResponse.json(
      { success: false, error: "Username not found" },
      { status: 404 }
    );
  } catch (error: any) {
    console.error("On-chain resolve error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
