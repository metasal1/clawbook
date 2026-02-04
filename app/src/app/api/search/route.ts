import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Search API — queries the Turso index for fast results.
 * Falls back to onchain getProgramAccounts if DB is unavailable.
 * 
 * GET /api/search?q=<query>&tab=profiles|posts&type=all|bot|human&sort=...&verified=1&limit=50&offset=0
 */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const q = params.get("q") || "";
  const tab = params.get("tab") || "profiles";
  const type = params.get("type") || "all";
  const sort = params.get("sort") || (tab === "profiles" ? "followers" : "newest");
  const verified = params.get("verified") === "1";
  const limit = Math.min(parseInt(params.get("limit") || "50"), 100);
  const offset = parseInt(params.get("offset") || "0");

  try {
    const db = getDb();

    if (tab === "profiles") {
      return await searchProfiles(db, { q, type, sort, verified, limit, offset });
    } else {
      return await searchPosts(db, { q, type, sort, limit, offset });
    }
  } catch (error: any) {
    // If Turso is not configured, return a helpful error
    if (error.message?.includes("Missing TURSO")) {
      return NextResponse.json({
        success: false,
        error: "Search index not configured. Using onchain fallback.",
        fallback: true,
      }, { status: 503 });
    }
    console.error("Search error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function searchProfiles(
  db: ReturnType<typeof getDb>,
  opts: { q: string; type: string; sort: string; verified: boolean; limit: number; offset: number }
) {
  const { q, type, sort, verified, limit, offset } = opts;
  const conditions: string[] = [];
  const args: any[] = [];

  // Full-text search if query provided
  let fromClause = "profiles p";
  if (q) {
    fromClause = `profiles p INNER JOIN profiles_fts fts ON p.rowid = fts.rowid`;
    conditions.push("profiles_fts MATCH ?");
    // FTS5 query syntax: prefix search with *
    args.push(`${q}*`);
  }

  // Type filter
  if (type !== "all") {
    conditions.push("p.account_type = ?");
    args.push(type);
  }

  // Verified filter
  if (verified) {
    conditions.push("p.verified = 1");
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(" AND ")}` 
    : "";

  // Sort
  let orderClause: string;
  switch (sort) {
    case "posts": orderClause = "ORDER BY p.post_count DESC"; break;
    case "alpha": orderClause = "ORDER BY p.username ASC"; break;
    case "newest": orderClause = "ORDER BY p.created_at DESC"; break;
    case "followers":
    default: orderClause = "ORDER BY p.follower_count DESC"; break;
  }

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM ${fromClause} ${whereClause}`,
    args,
  });
  const total = Number(countResult.rows[0]?.total || 0);

  const result = await db.execute({
    sql: `SELECT p.authority, p.address, p.username, p.bio, p.pfp, p.account_type,
            p.verified, p.post_count, p.follower_count, p.following_count, p.created_at
          FROM ${fromClause}
          ${whereClause}
          ${orderClause}
          LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const profiles = result.rows.map((row: any) => ({
    authority: row.authority,
    address: row.address,
    username: row.username,
    bio: row.bio,
    pfp: row.pfp,
    accountType: row.account_type,
    verified: Boolean(row.verified),
    postCount: Number(row.post_count),
    followerCount: Number(row.follower_count),
    followingCount: Number(row.following_count),
    createdAt: Number(row.created_at),
  }));

  return NextResponse.json({
    success: true,
    tab: "profiles",
    total,
    profiles,
    limit,
    offset,
    source: "index",
  });
}

async function searchPosts(
  db: ReturnType<typeof getDb>,
  opts: { q: string; type: string; sort: string; limit: number; offset: number }
) {
  const { q, type, sort, limit, offset } = opts;
  const conditions: string[] = [];
  const args: any[] = [];

  // Full-text search
  let fromClause = "posts po LEFT JOIN profiles pr ON po.author = pr.authority";
  if (q) {
    fromClause = `posts po LEFT JOIN profiles pr ON po.author = pr.authority
      INNER JOIN posts_fts fts ON po.rowid = fts.rowid`;
    conditions.push("posts_fts MATCH ?");
    args.push(`${q}*`);
  }

  // Type filter (by author's account type)
  if (type !== "all") {
    conditions.push("pr.account_type = ?");
    args.push(type);
  }

  const whereClause = conditions.length > 0 
    ? `WHERE ${conditions.join(" AND ")}` 
    : "";

  // Sort
  let orderClause: string;
  switch (sort) {
    case "oldest": orderClause = "ORDER BY po.created_at ASC"; break;
    case "likes": orderClause = "ORDER BY po.likes DESC"; break;
    case "newest":
    default: orderClause = "ORDER BY po.created_at DESC"; break;
  }

  const countResult = await db.execute({
    sql: `SELECT COUNT(*) as total FROM ${fromClause} ${whereClause}`,
    args,
  });
  const total = Number(countResult.rows[0]?.total || 0);

  const result = await db.execute({
    sql: `SELECT po.address, po.author, po.content, po.likes, po.created_at, po.post_id, po.compressed,
            pr.username, pr.pfp, pr.verified, pr.account_type
          FROM ${fromClause}
          ${whereClause}
          ${orderClause}
          LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });

  const posts = result.rows.map((row: any) => ({
    address: row.address,
    author: row.author,
    content: row.content,
    likes: Number(row.likes),
    createdAt: Number(row.created_at),
    postId: Number(row.post_id),
    compressed: Boolean(row.compressed),
    username: row.username || `${String(row.author).slice(0, 8)}...`,
    pfp: row.pfp || "",
    verified: Boolean(row.verified),
    accountType: row.account_type || "human",
  }));

  return NextResponse.json({
    success: true,
    tab: "posts",
    total,
    posts,
    limit,
    offset,
    source: "index",
  });
}
