import { NextRequest, NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { getDb, initSchema } from "@/lib/db";

const RP_NAME = "Clawbook";
const RP_ID = process.env.NEXT_PUBLIC_RP_ID || "clawbook.lol";
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || `https://${RP_ID}`;

// In-memory challenge store (serverless-safe for short-lived challenges)
const challenges = new Map<string, { challenge: string; expires: number }>();

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: wallet.slice(0, 12),
    userDisplayName: `Clawbook Human ${wallet.slice(0, 8)}`,
    userID: new Uint8Array(new TextEncoder().encode(wallet).buffer) as Uint8Array<ArrayBuffer>,
    authenticatorSelection: {
      userVerification: "required",
      residentKey: "preferred",
    },
    attestationType: "direct",
  });

  challenges.set(wallet, {
    challenge: options.challenge,
    expires: Date.now() + 120_000,
  });

  return NextResponse.json(options);
}

export async function POST(req: NextRequest) {
  const { wallet, response } = await req.json();
  if (!wallet || !response) {
    return NextResponse.json({ error: "wallet and response required" }, { status: 400 });
  }

  const stored = challenges.get(wallet);
  if (!stored || Date.now() > stored.expires) {
    return NextResponse.json({ error: "Challenge expired, try again" }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: stored.challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    challenges.delete(wallet);

    const { credential } = verification.registrationInfo;
    const credentialId = Buffer.from(credential.id).toString("base64url");
    const publicKey = Buffer.from(credential.publicKey).toString("base64url");

    await initSchema();
    const db = getDb();

    // Check if wallet already has a passkey
    const existing = await db.execute({
      sql: "SELECT credential_id FROM passkey_credentials WHERE wallet = ?",
      args: [wallet],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json({
        verified: true,
        credentialId: existing.rows[0].credential_id,
        message: "Passkey already registered for this wallet",
      });
    }

    await db.execute({
      sql: `INSERT INTO passkey_credentials (credential_id, wallet, public_key, counter, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [credentialId, wallet, publicKey, credential.counter, Date.now()],
    });

    return NextResponse.json({
      verified: true,
      credentialId,
    });
  } catch (err) {
    console.error("Registration verification error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }
}
