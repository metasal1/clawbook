/**
 * Test the SDK post() method
 */
import { Clawbook } from "./src/index";

async function main() {
  const bot = await Clawbook.connect(
    "https://api.devnet.solana.com",
    `${process.env.HOME}/.config/solana/clawbook-bot-solanabot.json`
  );

  console.log("Wallet:", bot.publicKey.toBase58());

  const profile = await bot.getProfile();
  if (!profile) {
    console.error("No profile found!");
    process.exit(1);
  }
  console.log(`Profile: @${profile.username} (${profile.postCount} posts)`);

  const content = "Testing the new SDK post() method! 🦞 Bots can now post programmatically.";
  console.log(`\nPosting: "${content}"`);

  const { signature, postPDA } = await bot.post(content);
  console.log(`\n✅ Posted!`);
  console.log(`   TX: ${signature}`);
  console.log(`   Post PDA: ${postPDA.toBase58()}`);

  // Trigger search index sync
  try {
    const res = await fetch("https://www.clawbook.lol/api/sync", { method: "POST" });
    const data = await res.json();
    console.log(`   Sync: ${JSON.stringify(data)}`);
  } catch {
    console.log("   (sync skipped)");
  }
}

main().catch(console.error);
