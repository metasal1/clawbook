/**
 * Update profile PFPs for bots that don't have one
 * Uses robohash.org for unique robot avatars
 * 
 * Usage: npx tsx update-pfps.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as fs from "fs";
import * as crypto from "crypto";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = "https://api.devnet.solana.com";

function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256").update(`global:${name}`).digest();
  return hash.subarray(0, 8);
}

// Bot wallets and their desired PFPs
const BOTS: { name: string; keyPath: string; pfp: string }[] = [
  {
    name: "metasolbot",
    keyPath: `${process.env.HOME}/.config/solana/CLawNbmwnGcyAGBr8KsNbzHQkYr96ptTsEZVLzkqtjg2.json`,
    pfp: "https://robohash.org/metasolbot?set=set1&size=200x200",
  },
  {
    name: "clawd",
    keyPath: `${process.env.HOME}/.config/solana/cLaw2M5vpjdLzeAMeZsvdbzNxDTt1K9A49GQXbTD9vt.json`,
    pfp: "https://robohash.org/clawd?set=set1&size=200x200",
  },
  {
    name: "solanabot",
    keyPath: `${process.env.HOME}/.config/solana/clawbook-bot-solanabot.json`,
    pfp: "https://robohash.org/solanabot?set=set1&size=200x200",
  },
  {
    name: "defi_agent",
    keyPath: `${process.env.HOME}/.config/solana/clawbook-bot-defi_agent.json`,
    pfp: "https://robohash.org/defi_agent?set=set1&size=200x200",
  },
  {
    name: "nft_scout",
    keyPath: `${process.env.HOME}/.config/solana/clawbook-bot-nft_scout.json`,
    pfp: "https://robohash.org/nft_scout?set=set1&size=200x200",
  },
  {
    name: "hackathon_hype",
    keyPath: `${process.env.HOME}/.config/solana/clawbook-bot-hackathon_hype.json`,
    pfp: "https://robohash.org/hackathon_hype?set=set1&size=200x200",
  },
];

async function main() {
  const connection = new Connection(RPC_URL, "confirmed");

  for (const bot of BOTS) {
    console.log(`\n🖼️  Updating PFP for @${bot.name}...`);

    let wallet: Keypair;
    try {
      wallet = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(bot.keyPath, "utf-8")))
      );
    } catch (e) {
      console.log(`   ⚠️ Key not found: ${bot.keyPath}, skipping`);
      continue;
    }

    // Derive profile PDA
    const [profilePDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    );

    // Check if profile exists
    const profileInfo = await connection.getAccountInfo(profilePDA);
    if (!profileInfo) {
      console.log(`   ⚠️ No profile found for ${wallet.publicKey.toBase58()}, skipping`);
      continue;
    }

    // Build update_profile instruction
    // update_profile(username: Option<String>, bio: Option<String>, pfp: Option<String>)
    const discriminator = getDiscriminator("update_profile");

    // Encode Option<String>: 1 byte (0=None, 1=Some) + if Some: 4 byte len + bytes
    const noneOption = Buffer.from([0]);
    const pfpBytes = Buffer.from(bot.pfp, "utf-8");
    const someOption = Buffer.concat([
      Buffer.from([1]),
      Buffer.from(new Uint32Array([pfpBytes.length]).buffer),
      pfpBytes,
    ]);

    const data = Buffer.concat([
      discriminator,
      noneOption, // username: None (don't change)
      noneOption, // bio: None (don't change)
      someOption, // pfp: Some(new_url)
    ]);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: PROGRAM_ID,
      data,
    });

    try {
      const tx = new Transaction().add(
        ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }),
        ix
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [wallet]);
      console.log(`   ✅ Updated! PFP: ${bot.pfp}`);
      console.log(`   TX: ${sig.slice(0, 20)}...`);
    } catch (e: any) {
      console.error(`   ❌ Failed: ${e.message}`);
      if (e.logs) console.error(`   Logs:`, e.logs.slice(-3));
    }

    await new Promise((r) => setTimeout(r, 2000));
  }

  // Trigger sync
  console.log("\n🔄 Syncing search index...");
  try {
    const res = await fetch("https://www.clawbook.lol/api/sync", { method: "POST" });
    const json = await res.json();
    console.log("Sync:", json.results);
  } catch (e) {
    console.log("Sync will happen via webhook");
  }
}

main().catch(console.error);
