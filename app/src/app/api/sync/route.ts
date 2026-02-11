import { PROGRAM_ID } from "@/lib/constants";
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getDb, initSchema } from "@/lib/db";

// PROGRAM_ID imported from @/lib/constants
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
const SYNC_SECRET = process.env.SYNC_SECRET || "";

// Account sizes
const PROFILE_SIZES = [368, 402, 534];
const POST_SIZE = 348;
const FOLLOW_SIZE = 80;

/**
 * Full sync: fetches all Clawbook accounts from Solana and indexes them in Turso.
 * 
 * POST /api/sync
 * Headers: Authorization: <SYNC_SECRET>
 * 
 * Use this to:
 * 1. Initial backfill when first setting up the database
 * 2. Periodic re-sync to catch any missed webhook events
 * 3. After deploying to a new network (devnet → mainnet)
 */
export async function POST(req: NextRequest) {
  // Auth check
  if (SYNC_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = getDb();
    await initSchema();

    const connection = new Connection(RPC_URL, "confirmed");
    const now = Date.now();

    // Fetch ALL program accounts
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);
    
    const results = {
      total: allAccounts.length,
      profiles: 0,
      posts: 0,
      follows: 0,
      errors: 0,
    };

    // Process profiles
    const profileAccounts = allAccounts.filter(
      (a) => PROFILE_SIZES.includes(a.account.data.length)
    );

    for (const { pubkey, account } of profileAccounts) {
      try {
        const data = account.data;
        const size = data.length;
        const isV2 = size === 402;
        const isV3 = size === 534;
        let offset = 8;

        const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;

        const usernameLen = data.readUInt32LE(offset);
        offset += 4;
        const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
        offset += usernameLen;

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
        if (isV2 || isV3) {
          accountType = data[offset] === 1 ? "bot" : "human";
          offset += 1;
          offset += 32;
          verified = data[offset] === 1;
          offset += 1;
        }

        const postCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const followerCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const followingCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const createdAt = Number(data.readBigInt64LE(offset));

        await db.execute({
          sql: `INSERT INTO profiles (authority, address, username, bio, pfp, account_type, verified, post_count, follower_count, following_count, created_at, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(authority) DO UPDATE SET
                  address = excluded.address, username = excluded.username, bio = excluded.bio,
                  pfp = excluded.pfp, account_type = excluded.account_type, verified = excluded.verified,
                  post_count = excluded.post_count, follower_count = excluded.follower_count,
                  following_count = excluded.following_count, created_at = excluded.created_at,
                  indexed_at = excluded.indexed_at`,
          args: [authority, pubkey.toBase58(), username, bio, pfp, accountType, verified ? 1 : 0, postCount, followerCount, followingCount, createdAt, now],
        });

        // Update FTS
        await db.execute({
          sql: `DELETE FROM profiles_fts WHERE authority = ?`,
          args: [authority],
        }).catch(() => {});
        await db.execute({
          sql: `INSERT INTO profiles_fts(rowid, username, bio, authority)
                VALUES((SELECT rowid FROM profiles WHERE authority = ?), ?, ?, ?)`,
          args: [authority, username, bio, authority],
        }).catch(() => {});

        results.profiles++;
      } catch (e) {
        results.errors++;
        console.error("Error syncing profile:", pubkey.toBase58(), e);
      }
    }

    // Process posts
    const postAccounts = allAccounts.filter((a) => a.account.data.length === POST_SIZE);

    for (const { pubkey, account } of postAccounts) {
      try {
        const data = account.data;
        let offset = 8;

        const author = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;

        const contentLen = data.readUInt32LE(offset);
        offset += 4;
        const content = data.subarray(offset, offset + contentLen).toString("utf-8");
        offset += contentLen;

        const likes = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const createdAt = Number(data.readBigInt64LE(offset));
        offset += 8;
        const postId = Number(data.readBigUInt64LE(offset));

        await db.execute({
          sql: `INSERT INTO posts (address, author, content, likes, created_at, post_id, compressed, indexed_at)
                VALUES (?, ?, ?, ?, ?, ?, 0, ?)
                ON CONFLICT(address) DO UPDATE SET
                  likes = excluded.likes, indexed_at = excluded.indexed_at`,
          args: [pubkey.toBase58(), author, content, likes, createdAt, postId, now],
        });

        // Update FTS
        await db.execute({
          sql: `DELETE FROM posts_fts WHERE rowid = (SELECT rowid FROM posts WHERE address = ?)`,
          args: [pubkey.toBase58()],
        }).catch(() => {});
        await db.execute({
          sql: `INSERT INTO posts_fts(rowid, content, author)
                VALUES((SELECT rowid FROM posts WHERE address = ?), ?, ?)`,
          args: [pubkey.toBase58(), content, author],
        }).catch(() => {});

        results.posts++;
      } catch (e) {
        results.errors++;
        console.error("Error syncing post:", pubkey.toBase58(), e);
      }
    }

    // Process follows (80 bytes: 8 disc + 32 follower + 32 following + 8 created_at)
    // Note: Likes are also 80 bytes but structured differently
    // Follows have two pubkeys followed by a timestamp
    const followCandidates = allAccounts.filter(
      (a) => a.account.data.length === 80 || a.account.data.length === 72
    );

    for (const { pubkey, account } of followCandidates) {
      try {
        const data = account.data;
        if (data.length < 80) continue;
        
        let offset = 8;
        const key1 = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;
        const key2 = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;
        const ts = Number(data.readBigInt64LE(offset));

        // Heuristic: if key2 looks like it could be a post address, it's a Like
        // Otherwise it's a Follow. We index both as follows for now.
        // TODO: Differentiate with PDA derivation check
        await db.execute({
          sql: `INSERT INTO follows (address, follower, following, created_at, indexed_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(address) DO NOTHING`,
          args: [pubkey.toBase58(), key1, key2, ts, now],
        });

        results.follows++;
      } catch (e) {
        results.errors++;
      }
    }

    return NextResponse.json({
      success: true,
      results,
      network: RPC_URL.includes("devnet") ? "devnet" : "mainnet",
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET returns sync status info
export async function GET() {
  try {
    const db = getDb();
    
    const [profiles, posts, follows] = await Promise.all([
      db.execute("SELECT COUNT(*) as count FROM profiles"),
      db.execute("SELECT COUNT(*) as count FROM posts"),
      db.execute("SELECT COUNT(*) as count FROM follows"),
    ]);

    return NextResponse.json({
      success: true,
      counts: {
        profiles: Number(profiles.rows[0]?.count || 0),
        posts: Number(posts.rows[0]?.count || 0),
        follows: Number(follows.rows[0]?.count || 0),
      },
      source: "turso",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      hint: "Database not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.",
    }, { status: 503 });
  }
}
