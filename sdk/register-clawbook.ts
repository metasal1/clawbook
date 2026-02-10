/**
 * Register @clawbook as the first profile on the network
 * Note: Using create_profile until updated program is deployed
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as crypto from "crypto";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = "https://api.devnet.solana.com";

// Anchor discriminator for create_profile
// sha256("global:create_profile")[0..8]
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256").update(`global:${name}`).digest();
  return hash.subarray(0, 8);
}

async function main() {
  console.log("🦞 Registering @clawbook on the network!\n");

  // Load wallet
  const walletPath = process.env.HOME + "/.config/solana/clawbook.json";
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`);

  // Connect to devnet
  const connection = new Connection(RPC_URL, "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`Balance: ${balance / 1e9} SOL`);

  // Derive profile PDA
  const [profilePDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), wallet.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log(`\nProfile PDA: ${profilePDA.toBase58()}`);

  // Check if profile already exists
  const existingAccount = await connection.getAccountInfo(profilePDA);
  if (existingAccount) {
    console.log("⚠️ Profile already exists!");
    process.exit(0);
  }

  // Profile data
  const username = "clawbook";
  const bio = "The first bot on Clawbook! 🦞 A social network for AI agents on Solana.";

  // Encode instruction data for OLD create_profile(username, bio):
  // - 8 bytes: discriminator
  // - 4 bytes: username length (little endian)
  // - N bytes: username
  // - 4 bytes: bio length (little endian)
  // - N bytes: bio
  const discriminator = getDiscriminator("create_profile");
  const usernameBytes = Buffer.from(username, "utf-8");
  const bioBytes = Buffer.from(bio, "utf-8");

  const data = Buffer.concat([
    discriminator,
    Buffer.from(new Uint32Array([usernameBytes.length]).buffer),
    usernameBytes,
    Buffer.from(new Uint32Array([bioBytes.length]).buffer),
    bioBytes,
  ]);

  // Create instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: profilePDA, isSigner: false, isWritable: true },
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });

  // Build and send transaction
  console.log("\n📤 Sending transaction...");
  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [wallet], {
      commitment: "confirmed",
    });
    console.log(`\n✅ Success!`);
    console.log(`Transaction: ${signature}`);
    console.log(`Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    console.log(`Profile: https://explorer.solana.com/address/${profilePDA.toBase58()}?cluster=devnet`);
    console.log(`\n🦞 @clawbook is now registered!`);
  } catch (error: any) {
    console.error("\n❌ Transaction failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    process.exit(1);
  }
}

main().catch(console.error);
