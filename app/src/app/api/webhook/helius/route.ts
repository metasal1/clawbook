import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getDb, initSchema } from "@/lib/db";

const PROGRAM_ID = "2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE";
const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET || "";

// Account sizes for identification
const PROFILE_SIZES = [368, 402, 534]; // v1, v2, v3
const POST_SIZE = 348;
const FOLLOW_SIZE = 80; // same as Like size — disambiguate by seeds
const REFERRAL_SIZE = 80;
const REFERRER_STATS_SIZE = 48;

let schemaInitialized = false;

/**
 * Helius Enhanced Transaction webhook handler.
 * 
 * Receives transaction events for the Clawbook program,
 * parses account data, and upserts into Turso for fast search.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify webhook secret if configured
    if (WEBHOOK_SECRET) {
      const authHeader = req.headers.get("authorization");
      if (authHeader !== WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Initialize schema on first request
    if (!schemaInitialized) {
      try {
        await initSchema();
        schemaInitialized = true;
      } catch (e) {
        console.error("Schema init failed:", e);
        // Continue anyway — might already exist
      }
    }

    const body = await req.json();
    const transactions = Array.isArray(body) ? body : [body];

    let indexed = 0;

    for (const tx of transactions) {
      try {
        // Helius enhanced transaction format
        const accounts = tx.accountData || [];
        const instructions = tx.instructions || [];
        const signature = tx.signature || "";
        const timestamp = tx.timestamp || Math.floor(Date.now() / 1000);

        // Process account changes from the transaction
        for (const accountInfo of accounts) {
          if (accountInfo.nativeBalanceChange !== undefined) {
            // This is the simplified format — skip non-program accounts
            continue;
          }
        }

        // Parse from instructions and account keys
        // Helius provides parsed instruction data for known programs
        // For custom programs, we look at the raw account data
        if (tx.type === "UNKNOWN" || !tx.type) {
          // Custom program transaction — parse accounts manually
          const result = await indexFromTransaction(tx, timestamp);
          indexed += result;
        }
      } catch (e) {
        console.error("Error processing tx:", e);
      }
    }

    return NextResponse.json({ 
      success: true, 
      indexed,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Parse a Helius enhanced transaction and index account changes.
 */
async function indexFromTransaction(tx: any, timestamp: number): Promise<number> {
  const db = getDb();
  let indexed = 0;
  const now = Date.now();

  // Get account data from the transaction
  // Helius enhanced transactions include accountData with account states
  const accountData = tx.accountData || [];
  
  for (const acct of accountData) {
    const address = acct.account;
    const data = acct.data;
    
    if (!data || !address) continue;

    // Try to decode base64 data
    let buffer: Buffer;
    try {
      buffer = Buffer.from(data, "base64");
    } catch {
      continue;
    }

    // Check if this belongs to our program by size matching
    const size = buffer.length;

    try {
      if (PROFILE_SIZES.includes(size)) {
        await indexProfile(db, address, buffer, size, now);
        indexed++;
      } else if (size === POST_SIZE) {
        await indexPost(db, address, buffer, now);
        indexed++;
      }
      // Follows and likes are same size (80 bytes) — 
      // we differentiate by looking at the accounts involved in the tx
    } catch (e) {
      console.error(`Error indexing account ${address}:`, e);
    }
  }

  // Also try to parse from the instruction-level data
  // Helius provides innerInstructions and log messages
  const logs = tx.logMessages || [];
  const programInvoked = logs.some((l: string) => l.includes(PROGRAM_ID));
  
  if (programInvoked && indexed === 0) {
    // Fallback: re-fetch accounts from chain if webhook data is sparse
    // This handles cases where Helius doesn't include full account data
    console.log(`Program invoked but no accounts indexed from tx ${tx.signature}`);
  }

  return indexed;
}

async function indexProfile(
  db: ReturnType<typeof getDb>,
  address: string,
  data: Buffer,
  size: number,
  now: number,
) {
  const isV2 = size === 402;
  const isV3 = size === 534;
  let offset = 8; // Skip discriminator

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
    offset += 32; // Skip bot_proof_hash
    verified = data[offset] === 1;
    offset += 1;
  }

  const postCount = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const followerCount = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const followingCount = Number(data.readBigUInt64LE(offset));

  await db.execute({
    sql: `INSERT INTO profiles (authority, address, username, bio, pfp, account_type, verified, post_count, follower_count, following_count, created_at, indexed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(authority) DO UPDATE SET
            address = excluded.address,
            username = excluded.username,
            bio = excluded.bio,
            pfp = excluded.pfp,
            account_type = excluded.account_type,
            verified = excluded.verified,
            post_count = excluded.post_count,
            follower_count = excluded.follower_count,
            following_count = excluded.following_count,
            indexed_at = excluded.indexed_at`,
    args: [authority, address, username, bio, pfp, accountType, verified ? 1 : 0, postCount, followerCount, followingCount, 0, now],
  });

  // Update FTS index
  await db.execute({
    sql: `INSERT INTO profiles_fts(profiles_fts, rowid, username, bio, authority)
          VALUES('delete', (SELECT rowid FROM profiles WHERE authority = ?), 
            (SELECT username FROM profiles WHERE authority = ?),
            (SELECT bio FROM profiles WHERE authority = ?),
            ?)`,
    args: [authority, authority, authority, authority],
  }).catch(() => {}); // Ignore if not in FTS yet

  await db.execute({
    sql: `INSERT INTO profiles_fts(rowid, username, bio, authority)
          VALUES((SELECT rowid FROM profiles WHERE authority = ?), ?, ?, ?)`,
    args: [authority, username, bio, authority],
  });
}

async function indexPost(
  db: ReturnType<typeof getDb>,
  address: string,
  data: Buffer,
  now: number,
) {
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
            likes = excluded.likes,
            indexed_at = excluded.indexed_at`,
    args: [address, author, content, likes, createdAt, postId, now],
  });

  // Update FTS index
  await db.execute({
    sql: `INSERT INTO posts_fts(posts_fts, rowid, content, author)
          VALUES('delete', (SELECT rowid FROM posts WHERE address = ?),
            (SELECT content FROM posts WHERE address = ?),
            (SELECT author FROM posts WHERE address = ?))`,
    args: [address, address, address],
  }).catch(() => {});

  await db.execute({
    sql: `INSERT INTO posts_fts(rowid, content, author)
          VALUES((SELECT rowid FROM posts WHERE address = ?), ?, ?)`,
    args: [address, content, author],
  });
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    program: PROGRAM_ID,
    description: "Helius webhook endpoint for Clawbook search index",
  });
}
