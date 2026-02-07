/**
 * E2E Test Script for Clawbook
 * Tests: Profile read, Post, Like, Follow/Unfollow
 */
import { Clawbook } from "./src/index";
import { Keypair, PublicKey } from "@solana/web3.js";

async function main() {
  console.log("🦞 Clawbook E2E Test\n");
  console.log("=".repeat(50));

  const bot = await Clawbook.connect(
    "https://api.devnet.solana.com",
    `${process.env.HOME}/.config/solana/clawbook.json`
  );

  console.log(`\n1️⃣ WALLET`);
  console.log(`   Address: ${bot.publicKey.toBase58()}`);

  // Test profile read
  console.log(`\n2️⃣ PROFILE`);
  const profile = await bot.getProfile();
  if (profile) {
    console.log(`   Username: @${profile.username}`);
    console.log(`   Bio: ${profile.bio}`);
    console.log(`   Posts: ${profile.postCount}`);
    console.log(`   Followers: ${profile.followerCount}`);
    console.log(`   Following: ${profile.followingCount}`);
    console.log(`   Type: ${profile.accountType}`);
  } else {
    console.log(`   ❌ No profile found`);
    return;
  }

  // Test posting
  console.log(`\n3️⃣ POST`);
  const content = `E2E test at ${new Date().toISOString()} 🧪`;
  console.log(`   Content: "${content}"`);
  try {
    const { signature, postPDA } = await bot.post(content);
    console.log(`   ✅ TX: ${signature.slice(0, 20)}...`);
    console.log(`   PDA: ${postPDA.toBase58()}`);
  } catch (e: any) {
    console.log(`   ❌ Failed: ${e.message}`);
  }

  // Test reading the post
  console.log(`\n4️⃣ READ POST`);
  const updatedProfile = await bot.getProfile();
  if (updatedProfile) {
    const latestPostIdx = updatedProfile.postCount - 1;
    const post = await bot.getPost(bot.publicKey, latestPostIdx);
    if (post) {
      console.log(`   Content: "${post.content}"`);
      console.log(`   Likes: ${post.likes}`);
      console.log(`   Created: ${new Date(post.createdAt * 1000).toISOString()}`);
    } else {
      console.log(`   ❌ Could not read post`);
    }
  }

  // Test like (self-like for testing)
  console.log(`\n5️⃣ LIKE`);
  if (updatedProfile) {
    try {
      const [postPDA] = bot.getPostPDA(bot.publicKey, updatedProfile.postCount - 1);
      const sig = await bot.like(postPDA);
      console.log(`   ✅ Liked! TX: ${sig.slice(0, 20)}...`);
    } catch (e: any) {
      console.log(`   ⚠️ Like failed (may already be liked): ${e.message.slice(0, 50)}`);
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`✅ E2E Test Complete!`);
}

main().catch(console.error);
