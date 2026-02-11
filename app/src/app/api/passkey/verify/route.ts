import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { getDb, initSchema } from "@/lib/db";

const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "clawbook.lol";
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || `https://${RP_ID}`;

const challenges = new Map<string, { challenge: string; expires: number }>();

// GET: generate authentication options
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  await initSchema();
  const db = getDb();

  const cred = await db.execute({
    sql: "SELECT credential_id FROM passkey_credentials WHERE wallet = ?",
    args: [wallet],
  });

  if (cred.rows.length === 0) {
    return NextResponse.json({ error: "No passkey registered for this wallet" }, { status: 404 });
  }

  const credentialId = cred.rows[0].credential_id as string;

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: [{ id: credentialId }],
    userVerification: "required",
  });

  challenges.set(wallet, {
    challenge: options.challenge,
    expires: Date.now() + 120_000,
  });

  return NextResponse.json(options);
}

// POST: verify authentication response
export async function POST(req: NextRequest) {
  const { wallet, response } = await req.json();
  if (!wallet || !response) {
    return NextResponse.json({ error: "wallet and response required" }, { status: 400 });
  }

  const stored = challenges.get(wallet);
  if (!stored || Date.now() > stored.expires) {
    return NextResponse.json({ error: "Challenge expired" }, { status: 400 });
  }

  await initSchema();
  const db = getDb();

  const cred = await db.execute({
    sql: "SELECT credential_id, public_key, counter FROM passkey_credentials WHERE wallet = ?",
    args: [wallet],
  });

  if (cred.rows.length === 0) {
    return NextResponse.json({ error: "No passkey found" }, { status: 404 });
  }

  const row = cred.rows[0] as unknown as {
    credential_id: string;
    public_key: string;
    counter: number;
  };
  const { credential_id, public_key, counter } = row;

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: credential_id,
        publicKey: Buffer.from(public_key, "base64url"),
        counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
    }

    challenges.delete(wallet);

    // Update counter
    await db.execute({
      sql: "UPDATE passkey_credentials SET counter = ? WHERE wallet = ?",
      args: [verification.authenticationInfo.newCounter, wallet],
    });

    // Check if human already claimed a bot
    const existingClaim = await db.execute({
      sql: "SELECT bot_authority FROM bot_claims WHERE owner_wallet = ?",
      args: [wallet],
    });

    return NextResponse.json({
      verified: true,
      credentialId: credential_id,
      alreadyClaimed: existingClaim.rows.length > 0,
      claimedBot: existingClaim.rows[0]?.bot_authority || null,
    });
  } catch (err) {
    console.error("Auth verification error:", err);
    return NextResponse.json({ error: "Authentication failed" }, { status: 400 });
  }
}
