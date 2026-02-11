import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
const FAUCET_AMOUNT = 1 * LAMPORTS_PER_SOL; // 1 SOL
const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory rate limit store (resets on deploy, which is fine for devnet)
const rateLimitMap = new Map<string, number>();

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimitMap) {
    if (now - timestamp > RATE_LIMIT_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 60 * 1000);

function getFaucetKeypair(): Keypair | null {
  const secret = process.env.FAUCET_KEYPAIR;
  if (!secret) return null;
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
  } catch {
    return null;
  }
}

/**
 * POST /api/faucet
 * Body: { "wallet": "<base58 pubkey>" }
 * 
 * Sends 1 devnet SOL to the wallet. Rate limited to 1 request per IP per day.
 */
export async function POST(req: NextRequest) {
  try {
    const faucetKeypair = getFaucetKeypair();
    if (!faucetKeypair) {
      return NextResponse.json(
        { error: "Faucet not configured" },
        { status: 503 }
      );
    }

    // Get client IP for rate limiting
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Check rate limit
    const lastRequest = rateLimitMap.get(ip);
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      const remainingMs = RATE_LIMIT_MS - (Date.now() - lastRequest);
      const remainingHrs = Math.ceil(remainingMs / (60 * 60 * 1000));
      return NextResponse.json(
        {
          error: `Rate limited. Try again in ~${remainingHrs} hour${remainingHrs > 1 ? "s" : ""}.`,
          retryAfterMs: remainingMs,
        },
        { status: 429 }
      );
    }

    // Parse request
    const body = await req.json();
    const walletAddress = body.wallet;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Missing wallet address" },
        { status: 400 }
      );
    }

    // Validate public key
    let recipient: PublicKey;
    try {
      recipient = new PublicKey(walletAddress);
    } catch {
      return NextResponse.json(
        { error: "Invalid wallet address" },
        { status: 400 }
      );
    }

    // Check faucet balance
    const connection = new Connection(RPC_URL, "confirmed");
    const faucetBalance = await connection.getBalance(faucetKeypair.publicKey);

    if (faucetBalance < FAUCET_AMOUNT + 5000) {
      return NextResponse.json(
        { error: "Faucet is empty. Please try again later." },
        { status: 503 }
      );
    }

    // Send SOL
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: faucetKeypair.publicKey,
        toPubkey: recipient,
        lamports: FAUCET_AMOUNT,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [faucetKeypair], {
      commitment: "confirmed",
    });

    // Record rate limit
    rateLimitMap.set(ip, Date.now());

    return NextResponse.json({
      success: true,
      amount: 1,
      signature,
      explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      wallet: walletAddress,
    });
  } catch (error: any) {
    console.error("Faucet error:", error);
    return NextResponse.json(
      { error: error.message || "Faucet transfer failed" },
      { status: 500 }
    );
  }
}

// GET: faucet status
export async function GET() {
  const faucetKeypair = getFaucetKeypair();
  if (!faucetKeypair) {
    return NextResponse.json({
      status: "not configured",
      hint: "Set FAUCET_KEYPAIR env var",
    });
  }

  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const balance = await connection.getBalance(faucetKeypair.publicKey);

    return NextResponse.json({
      status: "online",
      wallet: faucetKeypair.publicKey.toBase58(),
      balance: balance / LAMPORTS_PER_SOL,
      amountPerDrip: 1,
      network: RPC_URL.includes("devnet") ? "devnet" : "mainnet",
    });
  } catch (error: any) {
    return NextResponse.json({ status: "error", error: error.message });
  }
}
