const { Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } = require("@solana/web3.js");
const { BpfLoaderUpgradeable } = require("@solana/web3.js");
const multisig = require("@sqds/multisig");
const fs = require("fs");

const RPC = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
const PROGRAM_ID = new PublicKey("3mMxY4XcKrkPDHdLbUkssYy34smQtfhwBcfnMpLcBbZy");
const MULTISIG_PDA = new PublicKey("FUtXoDxnQfwcPAAPYPPnj8rjRfF37kTXVLcV8Jdbin3X");
const BOT_WALLET_PATH = "/Users/metasal/.config/solana/clawbook.json";
const PROGRAM_DATA = new PublicKey("28W6Tq5vZf6JwySYkFzpbG2JitgfjN9yXhUoCmGdGuPF");

// BPF Upgradeable Loader program
const BPF_LOADER_UPGRADEABLE = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const botKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(BOT_WALLET_PATH, "utf-8")))
  );
  
  console.log("Bot wallet:", botKeypair.publicKey.toBase58());
  
  // Get the multisig vault PDA (index 0)
  const [vaultPda] = multisig.getVaultPda({
    multisigPda: MULTISIG_PDA,
    index: 0,
  });
  console.log("Vault PDA:", vaultPda.toBase58());
  
  // Get current transaction index
  const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, MULTISIG_PDA);
  const currentIndex = Number(multisigAccount.transactionIndex);
  const newIndex = BigInt(currentIndex + 1);
  console.log("Current tx index:", currentIndex, "-> new:", newIndex.toString());
  
  // The instruction to set upgrade authority from vault back to bot wallet
  // This is: BPFLoaderUpgradeable::SetAuthority { new_authority: botWallet }
  // Accounts: [programData (writable), currentAuthority (signer=vault)]
  
  // SetAuthority instruction for BPF Loader Upgradeable
  // instruction index = 4 (SetAuthority), then Option<Pubkey> for new authority
  const data = Buffer.alloc(4 + 1 + 32);
  data.writeUInt32LE(4, 0); // SetAuthority variant
  data.writeUInt8(1, 4); // Some(new_authority)
  botKeypair.publicKey.toBuffer().copy(data, 5);
  
  const setAuthorityIx = {
    programId: BPF_LOADER_UPGRADEABLE,
    keys: [
      { pubkey: PROGRAM_DATA, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: true, isWritable: false },
      { pubkey: botKeypair.publicKey, isSigner: false, isWritable: false },
    ],
    data,
  };

  // Step 1: Create the vault transaction
  console.log("\n1. Creating vault transaction...");
  const tx1 = await multisig.instructions.vaultTransactionCreate({
    multisigPda: MULTISIG_PDA,
    transactionIndex: newIndex,
    creator: botKeypair.publicKey,
    vaultIndex: 0,
    ephemeralSigners: 0,
    transactionMessage: new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [setAuthorityIx],
    }),
  });

  const { blockhash: bh1 } = await connection.getLatestBlockhash();
  const msg1 = new TransactionMessage({
    payerKey: botKeypair.publicKey,
    recentBlockhash: bh1,
    instructions: [tx1],
  }).compileToV0Message();
  const vtx1 = new VersionedTransaction(msg1);
  vtx1.sign([botKeypair]);
  const sig1 = await connection.sendTransaction(vtx1);
  console.log("Vault tx created:", sig1);
  await connection.confirmTransaction(sig1, "confirmed");

  // Step 2: Create proposal
  console.log("\n2. Creating proposal...");
  const tx2 = await multisig.instructions.proposalCreate({
    multisigPda: MULTISIG_PDA,
    transactionIndex: newIndex,
    creator: botKeypair.publicKey,
  });

  const { blockhash: bh2 } = await connection.getLatestBlockhash();
  const msg2 = new TransactionMessage({
    payerKey: botKeypair.publicKey,
    recentBlockhash: bh2,
    instructions: [tx2],
  }).compileToV0Message();
  const vtx2 = new VersionedTransaction(msg2);
  vtx2.sign([botKeypair]);
  const sig2 = await connection.sendTransaction(vtx2);
  console.log("Proposal created:", sig2);
  await connection.confirmTransaction(sig2, "confirmed");

  // Step 3: Approve proposal
  console.log("\n3. Approving proposal...");
  const tx3 = await multisig.instructions.proposalApprove({
    multisigPda: MULTISIG_PDA,
    transactionIndex: newIndex,
    member: botKeypair.publicKey,
  });

  const { blockhash: bh3 } = await connection.getLatestBlockhash();
  const msg3 = new TransactionMessage({
    payerKey: botKeypair.publicKey,
    recentBlockhash: bh3,
    instructions: [tx3],
  }).compileToV0Message();
  const vtx3 = new VersionedTransaction(msg3);
  vtx3.sign([botKeypair]);
  const sig3 = await connection.sendTransaction(vtx3);
  console.log("Proposal approved:", sig3);
  await connection.confirmTransaction(sig3, "confirmed");

  // Step 4: Execute transaction
  console.log("\n4. Executing transaction...");
  const [transactionPda] = multisig.getTransactionPda({
    multisigPda: MULTISIG_PDA,
    index: newIndex,
  });
  
  const tx4 = await multisig.instructions.vaultTransactionExecute({
    multisigPda: MULTISIG_PDA,
    transactionIndex: newIndex,
    member: botKeypair.publicKey,
    connection,
  });

  const { blockhash: bh4 } = await connection.getLatestBlockhash();
  const msg4 = new TransactionMessage({
    payerKey: botKeypair.publicKey,
    recentBlockhash: bh4,
    instructions: [tx4.instruction],
  }).compileToV0Message(tx4.lookupTableAccounts);
  const vtx4 = new VersionedTransaction(msg4);
  vtx4.sign([botKeypair]);
  const sig4 = await connection.sendTransaction(vtx4);
  console.log("Transaction executed:", sig4);
  await connection.confirmTransaction(sig4, "confirmed");

  console.log("\n✅ Authority transferred back to bot wallet!");
  console.log("Bot wallet:", botKeypair.publicKey.toBase58());
}

main().catch(console.error);
