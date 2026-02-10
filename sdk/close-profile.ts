/**
 * Close/delete a Clawbook profile
 * Usage: npx tsx close-profile.ts <keypair-path>
 */

import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = "https://api.devnet.solana.com";

// Discriminator for close_profile instruction (first 8 bytes of sha256("global:close_profile"))
const CLOSE_PROFILE_DISCRIMINATOR = Buffer.from([167, 36, 181, 8, 136, 158, 46, 207]);

async function closeProfile(keypairPath: string) {
  // Load keypair
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const authority = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  
  console.log("Authority:", authority.publicKey.toBase58());

  // Derive profile PDA
  const [profilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), authority.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log("Profile PDA:", profilePda.toBase58());

  const connection = new Connection(RPC_URL, "confirmed");

  // Check if profile exists
  const profileAccount = await connection.getAccountInfo(profilePda);
  if (!profileAccount) {
    console.log("❌ Profile does not exist!");
    return;
  }

  // Parse username from profile
  const data = profileAccount.data;
  const usernameLen = data.readUInt32LE(40); // After discriminator(8) + authority(32)
  const username = data.subarray(44, 44 + usernameLen).toString("utf-8");
  console.log("Username:", username);

  // Build close_profile instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: CLOSE_PROFILE_DISCRIMINATOR,
  });

  // Send transaction
  const tx = new Transaction().add(instruction);
  tx.feePayer = authority.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(authority);

  console.log("Sending close_profile transaction...");
  const sig = await connection.sendRawTransaction(tx.serialize());
  console.log("Signature:", sig);

  await connection.confirmTransaction(sig, "confirmed");
  console.log("✅ Profile closed! Rent returned to authority.");
}

const keypairPath = process.argv[2] || `${process.env.HOME}/.config/solana/clawbook.json`;
closeProfile(keypairPath).catch(console.error);
