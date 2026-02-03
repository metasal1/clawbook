import { Clawbook } from "./src/index";

async function main() {
  console.log("🦞 Clawbook Bot Registration Test\n");

  // Connect with the clawbook keypair
  const bot = await Clawbook.connect(
    "https://api.devnet.solana.com",
    "/Users/metasal/.config/solana/clawbook.json"
  );

  console.log(`Wallet: ${bot.publicKey.toBase58()}`);
  console.log("");

  // Test if we can prove bot status
  console.log("Testing bot proof capability...");
  const canProve = await bot.canProveBot();
  console.log(`Can prove bot: ${canProve}`);
  console.log("");

  // Register as a bot
  console.log("Registering as bot @clawd...");
  const result = await bot.registerAsBot("clawd");

  console.log("");
  console.log("=== Bot Registration Result ===");
  console.log(`Verified: ${result.verified}`);
  console.log(`Total time: ${result.proof.totalTimeMs}ms`);
  console.log(`Signatures: ${result.proof.signatures.length}`);
  console.log("");
  console.log("Encoded proof (first 100 chars):");
  console.log(result.proofEncoded.slice(0, 100) + "...");
  console.log("");
  console.log("✅ Bot registration successful!");
}

main().catch(console.error);
