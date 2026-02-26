#!/usr/bin/env node

const { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const fs = require("fs");

const RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
const KEYPAIR_PATH = "/Users/metasal/.config/solana/clawbook.json";

async function main() {
  const [toAddress, amountSol] = process.argv.slice(2);
  
  if (!toAddress || !amountSol) {
    console.error("Usage: node send-sol.js <to-address> <amount-in-sol>");
    process.exit(1);
  }

  const connection = new Connection(RPC, "confirmed");
  const secretKey = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8"));
  const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
  
  console.log(`From: ${keypair.publicKey.toBase58()}`);
  console.log(`To: ${toAddress}`);
  console.log(`Amount: ${amountSol} SOL`);
  
  // Check balance
  const balance = await connection.getBalance(keypair.publicKey);
  console.log(`Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  
  const amount = parseFloat(amountSol);
  if (balance < amount * LAMPORTS_PER_SOL) {
    console.error("Insufficient balance!");
    process.exit(1);
  }
  
  // Send
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: keypair.publicKey,
      toPubkey: new PublicKey(toAddress),
      lamports: amount * LAMPORTS_PER_SOL,
    })
  );
  
  console.log("\nSending...");
  const signature = await sendAndConfirmTransaction(connection, tx, [keypair]);
  console.log(`✅ Sent ${amountSol} SOL`);
  console.log(`Signature: ${signature}`);
  console.log(`Explorer: https://solscan.io/tx/${signature}`);
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
