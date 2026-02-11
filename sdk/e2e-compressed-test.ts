/**
 * E2E test for compressed posts
 * Uses standard devnet for regular ops, Helius for compression proofs
 */
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import * as fs from "fs";
import { Clawbook } from "./src/index";
import {
  createRpc,
  defaultTestStateTreeAccounts,
  defaultStaticAccountsStruct,
  deriveAddressSeed,
  deriveAddress,
  lightSystemProgram,
  accountCompressionProgram,
  noopProgram,
  bn,
} from "@lightprotocol/stateless.js";

const HELIUS_KEY = "8140c51f-e972-443b-a5b4-c7f440ff200e";
const HELIUS_RPC = `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const STD_RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const TREASURY_PATH = `${process.env.HOME}/.config/solana/clawbook.json`;

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("🧪 Compressed Post E2E Test\n");

  const connection = new Connection(STD_RPC, "confirmed");
  
  const treasuryKey = JSON.parse(fs.readFileSync(TREASURY_PATH, "utf-8"));
  const treasury = Keypair.fromSecretKey(Uint8Array.from(treasuryKey));
  console.log(`💰 Treasury: ${treasury.publicKey.toBase58()}`);

  // Use existing profile that we know works — treasury wallet
  // First check if treasury has a profile
  const clawbook = new Clawbook(connection, treasury, PROGRAM_ID);
  
  const profile = await clawbook.getProfile();
  if (!profile) {
    console.log("Treasury has no profile. Creating...");
    await clawbook.createProfile("clawbook_treasury", "Official Clawbook Treasury 🦞");
    await sleep(3000);
  } else {
    console.log(`✅ Treasury profile: @${profile.username} (${profile.postCount} posts)`);
  }

  // Test compression proof fetch via Helius
  console.log("\n📡 Testing Helius compression endpoint...");
  try {
    const rpc = createRpc(HELIUS_RPC, HELIUS_RPC);
    const treeAccounts = defaultTestStateTreeAccounts();
    
    const postCountBytes = Buffer.alloc(8);
    const currentPostCount = profile ? profile.postCount : 0;
    postCountBytes.writeBigUInt64LE(BigInt(currentPostCount));

    const addressSeed = deriveAddressSeed(
      [
        Buffer.from("compressed_post"),
        treasury.publicKey.toBuffer(),
        postCountBytes,
      ],
      PROGRAM_ID
    );

    const address = deriveAddress(addressSeed, treeAccounts.addressTree);
    const addressBn = bn(address.toBytes());

    console.log("   Fetching validity proof...");
    const validityProof = await rpc.getValidityProofV0(
      [],
      [{ address: addressBn, tree: treeAccounts.addressTree, queue: treeAccounts.addressQueue }]
    );

    if (validityProof.compressedProof) {
      console.log("   ✅ Validity proof received!");
      console.log(`   Proof A length: ${validityProof.compressedProof.a.length}`);
      console.log(`   Root indices: ${validityProof.rootIndices}`);
    } else {
      console.log("   ❌ No compressed proof returned");
    }
  } catch (e: any) {
    console.error(`   ❌ Compression endpoint error: ${e.message}`);
  }

  // Now try the full compressed post with Helius connection for SDK
  console.log("\n3️⃣  Creating compressed post...");
  try {
    // Create a new Clawbook instance with Helius RPC for compression support
    const heliusConnection = new Connection(HELIUS_RPC, "confirmed");
    const heliusClawbook = new Clawbook(heliusConnection, treasury, PROGRAM_ID);
    
    const { signature } = await heliusClawbook.post("🦞 ZK Compressed post E2E test via Light Protocol! 312x cheaper on-chain storage.");
    console.log(`   ✅ COMPRESSED POST SUCCESS!`);
    console.log(`   TX: ${signature}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  } catch (e: any) {
    console.error(`   ❌ Failed: ${e.message}`);
    if (e.logs) console.error(`   Logs:`, e.logs.slice(-5));
  }

  console.log("\n✅ Test complete!");
}

main().catch(console.error);
