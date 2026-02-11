import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from "@solana/spl-token";

const TOKEN_MINT = new PublicKey("Ard5TxtbtBf5gkdnRqb1SPVjyKZMHPAaG37EkE4xBAGS");
const AIRDROP_AMOUNT = BigInt("100000000000000"); // 100k tokens (9 decimals)
const RPC_URL = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
const BOT_KEYPAIR_B64 = process.env.BOT_KEYPAIR_JSON || "";

async function initAirdropTable() {
  const db = getDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS airdrops (
    wallet TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    amount TEXT NOT NULL,
    tx_signature TEXT,
    created_at INTEGER NOT NULL DEFAULT 0
  )`);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_airdrops_ip ON airdrops(ip)`);
}

let tableInit = false;

export async function POST(req: NextRequest) {
  try {
    if (!tableInit) {
      await initAirdropTable();
      tableInit = true;
    }

    const { wallet } = await req.json();
    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
    }

    // Validate wallet is a valid pubkey
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(wallet);
    } catch {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    // Get client IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const db = getDb();

    // Check wallet uniqueness
    const walletCheck = await db.execute({
      sql: "SELECT wallet FROM airdrops WHERE wallet = ?",
      args: [wallet],
    });
    if (walletCheck.rows.length > 0) {
      return NextResponse.json({ error: "Wallet already claimed" }, { status: 409 });
    }

    // Check IP uniqueness
    const ipCheck = await db.execute({
      sql: "SELECT COUNT(*) as cnt FROM airdrops WHERE ip = ?",
      args: [ip],
    });
    const ipCount = (ipCheck.rows[0]?.cnt as number) || 0;
    if (ipCount > 0) {
      return NextResponse.json({ error: "IP already claimed" }, { status: 409 });
    }

    // Load bot keypair
    if (!BOT_KEYPAIR_JSON()) {
      return NextResponse.json({ error: "Airdrop not configured" }, { status: 500 });
    }
    const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(BOT_KEYPAIR_JSON())));

    const conn = new Connection(RPC_URL, "confirmed");

    // Get source ATA
    const srcAta = await getAssociatedTokenAddress(TOKEN_MINT, keypair.publicKey);
    const srcAccount = await getAccount(conn, srcAta);
    if (srcAccount.amount < AIRDROP_AMOUNT) {
      return NextResponse.json({ error: "Airdrop pool exhausted" }, { status: 503 });
    }

    // Build transfer tx
    const destAta = await getAssociatedTokenAddress(TOKEN_MINT, recipientPubkey, true);
    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));

    // Create dest ATA if needed
    try {
      await getAccount(conn, destAta);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey,
          destAta,
          recipientPubkey,
          TOKEN_MINT
        )
      );
    }

    tx.add(createTransferInstruction(srcAta, destAta, keypair.publicKey, AIRDROP_AMOUNT));

    const { blockhash } = await conn.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    const signature = await conn.sendRawTransaction(tx.serialize());
    await conn.confirmTransaction(signature, "confirmed");

    // Record airdrop
    await db.execute({
      sql: "INSERT INTO airdrops (wallet, ip, amount, tx_signature, created_at) VALUES (?, ?, ?, ?, ?)",
      args: [wallet, ip, AIRDROP_AMOUNT.toString(), signature, Math.floor(Date.now() / 1000)],
    });

    return NextResponse.json({
      success: true,
      amount: "100000",
      token: TOKEN_MINT.toBase58(),
      signature,
      explorer: `https://solscan.io/tx/${signature}`,
    });
  } catch (e: unknown) {
    console.error("Airdrop error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function BOT_KEYPAIR_JSON(): string {
  return process.env.BOT_KEYPAIR_JSON || "";
}

// GET — check airdrop status / remaining
export async function GET() {
  try {
    if (!tableInit) {
      await initAirdropTable();
      tableInit = true;
    }
    const db = getDb();
    const count = await db.execute("SELECT COUNT(*) as cnt FROM airdrops");
    const claimed = (count.rows[0]?.cnt as number) || 0;

    return NextResponse.json({
      token: TOKEN_MINT.toBase58(),
      amountPerSignup: "100,000",
      totalClaimed: claimed,
    });
  } catch {
    return NextResponse.json({ error: "DB not ready" }, { status: 500 });
  }
}
