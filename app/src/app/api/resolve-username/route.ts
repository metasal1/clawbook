import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * Resolve a username to a wallet address (authority).
 * Used by the profile page to support /profile/<username> URLs.
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

  try {
    const db = getDb();

    // Exact match (case-insensitive)
    const result = await db.execute({
      sql: `SELECT authority, address, username, pfp, account_type, verified
            FROM profiles
            WHERE LOWER(username) = LOWER(?)
            LIMIT 1`,
      args: [username],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Username not found" },
        { status: 404 }
      );
    }

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
  } catch (error: any) {
    if (error.message?.includes("Missing TURSO")) {
      return NextResponse.json(
        { success: false, error: "Search index not configured" },
        { status: 503 }
      );
    }
    console.error("Resolve username error:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
