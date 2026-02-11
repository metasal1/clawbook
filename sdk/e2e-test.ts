/**
 * E2E test using existing clawbook treasury wallet
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";
import { Clawbook } from "./src/index";

const RPC_URL = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const TREASURY_PATH = `${process.env.HOME}/.config/solana/clawbook.json`;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("🧪 Clawbook E2E Test\n");

  const connection = new Connection(RPC_URL, "confirmed");
  
  // Load treasury wallet
  const treasuryKey = JSON.parse(fs.readFileSync(TREASURY_PATH, "utf-8"));
  const treasury = Keypair.fromSecretKey(Uint8Array.from(treasuryKey));
  console.log(`💰 Treasury: ${treasury.publicKey.toBase58()}`);
  
  const treasuryBalance = await connection.getBalance(treasury.publicKey);
  console.log(`   Balance: ${treasuryBalance / LAMPORTS_PER_SOL} SOL`);

  // Create fresh test wallet and fund from treasury
  const testWallet = Keypair.generate();
  console.log(`\n1️⃣  Test wallet: ${testWallet.publicKey.toBase58()}`);

  console.log("   Funding from treasury (0.05 SOL)...");
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: testWallet.publicKey,
      lamports: 0.05 * LAMPORTS_PER_SOL,
    })
  );
  const fundSig = await sendAndConfirmTransaction(connection, fundTx, [treasury]);
  console.log(`   Funded ✅ (TX: ${fundSig.slice(0, 16)}...)`);
  await sleep(1000);

  // Init SDK
  const clawbook = new Clawbook(connection, testWallet, PROGRAM_ID);

  // Test 1: Create profile
  console.log("\n2️⃣  Creating profile...");
  try {
    const username = `e2e_${Date.now().toString(36)}`;
    const sig = await clawbook.createProfile(username, "E2E test bot 🧪");
    console.log(`   ✅ Profile: ${username} (TX: ${sig.slice(0, 16)}...)`);
    await sleep(2000);
  } catch (e: any) {
    console.error(`   ❌ Profile failed: ${e.message}`);
    if (e.logs) console.error(`   Logs:`, e.logs.slice(-5));
    return;
  }

  // Test 2: Read profile
  console.log("\n3️⃣  Reading profile...");
  try {
    const profile = await clawbook.getProfile();
    if (profile) {
      console.log(`   ✅ Username: ${profile.username}`);
      console.log(`   ✅ Bio: ${profile.bio}`);
      console.log(`   ✅ Post count: ${profile.postCount}`);
    } else {
      console.error("   ❌ Profile not found!");
      return;
    }
  } catch (e: any) {
    console.error(`   ❌ ${e.message}`);
    return;
  }

  // Test 3: Compressed post (Light Protocol)
  console.log("\n4️⃣  Creating compressed post (Light Protocol)...");
  try {
    const { signature } = await clawbook.post("E2E test: compressed post via Light Protocol 🦞⚡");
    console.log(`   ✅ Compressed post (TX: ${signature.slice(0, 16)}...)`);
  } catch (e: any) {
    console.error(`   ❌ Compressed post failed: ${e.message}`);
    if (e.message.includes("proof") || e.message.includes("indexer") || e.message.includes("fetch")) {
      console.log("   ⚠️  Standard devnet RPC doesn't support compression endpoints.");
      console.log("   Need Helius RPC for Light Protocol. Testing fallback...");
    }
    if (e.logs) console.error(`   Logs:`, e.logs.slice(-3));
  }

  // Test 4: Update profile
  console.log("\n5️⃣  Updating profile bio...");
  try {
    const sig = await clawbook.updateProfile(undefined, "Updated bio from E2E test ✅");
    console.log(`   ✅ Bio updated (TX: ${sig.slice(0, 16)}...)`);
  } catch (e: any) {
    console.error(`   ❌ Update failed: ${e.message}`);
    if (e.logs) console.error(`   Logs:`, e.logs.slice(-3));
  }

  // Test 5: Follow a known profile (solanabot)
  const SOLANABOT = new PublicKey("9WxZX3wy2GvtHDQWpJ7VbqxWFi7CXBgGKgy5gUFibdg1");
  console.log("\n6️⃣  Following solanabot...");
  try {
    const sig = await clawbook.follow(SOLANABOT);
    console.log(`   ✅ Followed (TX: ${sig.slice(0, 16)}...)`);
  } catch (e: any) {
    console.error(`   ❌ Follow failed: ${e.message}`);
    if (e.logs) console.error(`   Logs:`, e.logs.slice(-3));
  }

  console.log("\n" + "=".repeat(50));
  console.log("🧪 E2E Test Complete!");
  
  // Final balance
  const finalBalance = await connection.getBalance(testWallet.publicKey);
  console.log(`\n💰 Test wallet remaining: ${finalBalance / LAMPORTS_PER_SOL} SOL`);
  console.log(`   Cost: ${(0.05 - finalBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
}

main().catch(console.error);
