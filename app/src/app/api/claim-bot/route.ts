import { NextRequest, NextResponse } from "next/server";
import { getDb, initSchema } from "@/lib/db";

// Record a bot claim after the on-chain tx succeeds
export async function POST(req: NextRequest) {
  const { botAuthority, ownerWallet, credentialId, txSignature } = await req.json();

  if (!botAuthority || !ownerWallet || !credentialId || !txSignature) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await initSchema();
  const db = getDb();

  // Verify the passkey credential belongs to this wallet
  const cred = await db.execute({
    sql: "SELECT credential_id FROM passkey_credentials WHERE wallet = ? AND credential_id = ?",
    args: [ownerWallet, credentialId],
  });

  if (cred.rows.length === 0) {
    return NextResponse.json({ error: "Invalid credential for wallet" }, { status: 403 });
  }

  // Check for existing claims
  const existingBot = await db.execute({
    sql: "SELECT owner_wallet FROM bot_claims WHERE bot_authority = ?",
    args: [botAuthority],
  });
  if (existingBot.rows.length > 0) {
    return NextResponse.json({ error: "Bot already claimed" }, { status: 409 });
  }

  const existingHuman = await db.execute({
    sql: "SELECT bot_authority FROM bot_claims WHERE owner_wallet = ?",
    args: [ownerWallet],
  });
  if (existingHuman.rows.length > 0) {
    return NextResponse.json({ error: "You already claimed a bot" }, { status: 409 });
  }

  await db.execute({
    sql: `INSERT INTO bot_claims (bot_authority, owner_wallet, credential_id, claimed_at, tx_signature)
          VALUES (?, ?, ?, ?, ?)`,
    args: [botAuthority, ownerWallet, credentialId, Date.now(), txSignature],
  });

  return NextResponse.json({ success: true });
}

// Check claim status
export async function GET(req: NextRequest) {
  const bot = req.nextUrl.searchParams.get("bot");
  const owner = req.nextUrl.searchParams.get("owner");

  await initSchema();
  const db = getDb();

  if (bot) {
    const claim = await db.execute({
      sql: "SELECT * FROM bot_claims WHERE bot_authority = ?",
      args: [bot],
    });
    return NextResponse.json({ claimed: claim.rows.length > 0, claim: claim.rows[0] || null });
  }

  if (owner) {
    const claim = await db.execute({
      sql: "SELECT * FROM bot_claims WHERE owner_wallet = ?",
      args: [owner],
    });
    return NextResponse.json({ claimed: claim.rows.length > 0, claim: claim.rows[0] || null });
  }

  return NextResponse.json({ error: "Provide ?bot= or ?owner= param" }, { status: 400 });
}
