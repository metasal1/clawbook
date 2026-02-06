#!/usr/bin/env ts-node
/**
 * Migrate all old-format profiles (402 bytes, no pfp field) to the new format (534 bytes, with pfp).
 * 
 * Old profiles cause OOM errors when instructions try to deserialize them with the new schema.
 * This script finds all old profiles and calls the migrate_profile instruction.
 * 
 * Usage:
 *   npx ts-node sdk/migrate-profiles.ts [--rpc https://...] [--keypair ~/.config/solana/id.json]
 */

import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import Clawbook from "./src/index";

const args = process.argv.slice(2);
let rpcUrl = "https://api.devnet.solana.com";
let keypairPath = "~/.config/solana/id.json";

// Parse args
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--rpc" && args[i + 1]) {
    rpcUrl = args[i + 1];
    i++;
  }
  if (args[i] === "--keypair" && args[i + 1]) {
    keypairPath = args[i + 1];
    i++;
  }
}

keypairPath = keypairPath.replace("~", process.env.HOME || "");

async function main() {
  console.log("🔄 Profile Migration Tool");
  console.log(`RPC: ${rpcUrl}`);
  console.log(`Keypair: ${keypairPath}`);
  console.log("");

  const connection = new Connection(rpcUrl, "confirmed");
  const PROGRAM_ID = new PublicKey(
    "2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE"
  );

  // Find old profile accounts (402 bytes)
  console.log("📋 Scanning for old-format profiles...");
  const oldProfiles = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: 402 }],
  });

  if (oldProfiles.length === 0) {
    console.log("✅ No old-format profiles found. All profiles are up to date!");
    return;
  }

  console.log(`⚠️  Found ${oldProfiles.length} old-format profile(s):`);

  for (const { pubkey, account } of oldProfiles) {
    let offset = 8 + 32; // Skip discriminator + authority
    const usernameLen = account.data.readUInt32LE(offset);
    offset += 4;
    const username = account.data
      .subarray(offset, offset + usernameLen)
      .toString("utf-8");
    console.log(`   - ${username.padEnd(20)} @ ${pubkey.toBase58()}`);
  }

  console.log("");
  console.log("🚀 Starting migrations...");
  console.log("");

  // Load wallet
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  const clawbook = new Clawbook(connection, wallet);

  // Migrate each profile
  let successCount = 0;
  let failureCount = 0;

  for (const { pubkey, account } of oldProfiles) {
    let offset = 8 + 32;
    const usernameLen = account.data.readUInt32LE(offset);
    offset += 4;
    const username = account.data
      .subarray(offset, offset + usernameLen)
      .toString("utf-8");

    try {
      console.log(`⏳ Migrating ${username}...`);
      const sig = await clawbook.migrateProfile();
      console.log(`   ✅ Success: ${sig.slice(0, 20)}...`);
      successCount++;
    } catch (err) {
      console.log(
        `   ❌ Failed: ${err instanceof Error ? err.message : String(err)}`
      );
      failureCount++;
    }

    // Small delay between migrations to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("");
  console.log("📊 Migration Summary:");
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);

  if (failureCount === 0) {
    console.log("");
    console.log("🎉 All profiles migrated successfully!");
  }
}

main().catch(console.error);
