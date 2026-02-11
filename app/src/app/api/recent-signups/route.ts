import { NextResponse } from "next/server";
import { getDb, initSchema } from "@/lib/db";

let schemaInit = false;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!schemaInit) {
      await initSchema();
      schemaInit = true;
    }
    const db = getDb();
    // Get profiles created in the last 24h, ordered by newest first
    const cutoff = Math.floor(Date.now() / 1000) - 86400;
    const result = await db.execute({
      sql: `SELECT username, account_type, pfp, created_at FROM profiles 
            WHERE created_at > ? ORDER BY created_at DESC LIMIT 20`,
      args: [cutoff],
    });
    return NextResponse.json({
      success: true,
      signups: result.rows.map((r) => ({
        username: r.username,
        type: r.account_type,
        pfp: r.pfp,
        createdAt: r.created_at,
      })),
    });
  } catch (e) {
    return NextResponse.json({ success: false, signups: [] });
  }
}
