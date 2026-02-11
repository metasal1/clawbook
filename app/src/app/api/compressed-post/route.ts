import { PROGRAM_ID } from "@/lib/constants";
/**
 * API route for ZK Compressed Post proof fetching.
 *
 * The Light Protocol SDK has Node.js dependencies that don't work client-side,
 * so we fetch the validity proof and derive addresses server-side.
 *
 * POST /api/compressed-post
 * Body: { wallet: string, content: string }
 * Returns: proof data, tree info, remaining accounts for building the tx client-side
 */
import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Connection } from "@solana/web3.js";
import {
  createRpc,
  defaultTestStateTreeAccounts,
  defaultStaticAccountsStruct,
  deriveAddressSeed,
  deriveAddress,
  getRegisteredProgramPda,
  getAccountCompressionAuthority,
  lightSystemProgram,
  accountCompressionProgram,
  noopProgram,
  bn,
} from "@lightprotocol/stateless.js";


/**
 * Build a compression-capable RPC URL.
 * Prefers HELIUS_API_KEY env, then falls back to NEXT_PUBLIC_RPC_URL.
 */
function getCompressionRpcUrl(): string {
  if (process.env.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com?api-key=${process.env.HELIUS_API_KEY}`;
  }
  if (process.env.NEXT_PUBLIC_RPC_URL) {
    return process.env.NEXT_PUBLIC_RPC_URL;
  }
  // Fallback to standard devnet (will fail for compression calls)
  return "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { wallet, content } = body;

    if (!wallet || !content) {
      return NextResponse.json(
        { error: "Missing wallet or content" },
        { status: 400 }
      );
    }

    if (content.length > 280) {
      return NextResponse.json(
        { error: "Content must be 280 characters or less" },
        { status: 400 }
      );
    }

    const walletPubkey = new PublicKey(wallet);
    const rpcUrl = getCompressionRpcUrl();

    // Create compression-aware RPC (same URL for both standard and compression endpoints)
    const rpc = createRpc(rpcUrl, rpcUrl);

    // Derive profile PDA to read post_count
    const [profilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), walletPubkey.toBuffer()],
      PROGRAM_ID
    );

    // Read profile account to get current post_count
    const profileAccount = await rpc.getAccountInfo(profilePda);
    if (!profileAccount) {
      return NextResponse.json(
        { error: "Profile not found. Create a profile first." },
        { status: 404 }
      );
    }

    // Parse post_count from profile data
    // Profile layout: 8 (disc) + 32 (authority) + 4+var (username) + 4+var (bio) + 4+var (pfp) + 1 (account_type) + 32 (bot_proof_hash) + 1 (verified) + 8 (post_count) + ...
    const data = profileAccount.data;
    let offset = 8 + 32; // skip discriminator + authority

    // username (borsh string: 4 byte len + data)
    const usernameLen = data.readUInt32LE(offset);
    offset += 4 + usernameLen;

    // bio
    const bioLen = data.readUInt32LE(offset);
    offset += 4 + bioLen;

    // pfp
    const pfpLen = data.readUInt32LE(offset);
    offset += 4 + pfpLen;

    // account_type (1 byte) + bot_proof_hash (32 bytes) + verified (1 byte)
    offset += 1 + 32 + 1;

    // post_count (u64 LE)
    const postCountBuf = data.subarray(offset, offset + 8);
    const postCount = Number(postCountBuf.readBigUInt64LE(0));

    // Get default devnet tree accounts
    const treeAccounts = defaultTestStateTreeAccounts();
    const staticAccounts = defaultStaticAccountsStruct();

    // Derive address seed for the compressed post
    // Must match onchain: seeds = [b"compressed_post", fee_payer, post_count_bytes]
    const postCountBytes = Buffer.alloc(8);
    postCountBytes.writeBigUInt64LE(BigInt(postCount));

    const addressSeed = deriveAddressSeed(
      [
        Buffer.from("compressed_post"),
        walletPubkey.toBuffer(),
        postCountBytes,
      ],
      PROGRAM_ID
    );

    const address = deriveAddress(addressSeed, treeAccounts.addressTree);

    // Convert PublicKey to BN254 for the proof request
    const addressBn = bn(address.toBytes());

    // Get validity proof for the new address
    const validityProof = await rpc.getValidityProofV0(
      [], // no input hashes (creating new account)
      [
        {
          address: addressBn,
          tree: treeAccounts.addressTree,
          queue: treeAccounts.addressQueue,
        },
      ]
    );

    // Tree accounts layout in remaining_accounts[8..]:
    // [0] = state tree (merkleTree)
    // [1] = nullifier queue
    // [2] = address tree
    // [3] = address queue
    const outputTreeIndex = 0;
    const addressMerkleTreePubkeyIndex = 2;
    const addressQueuePubkeyIndex = 3;

    // Root index for the address tree from the validity proof
    const addressRootIndex = validityProof.rootIndices[0];

    // The Light System Program ID
    const lightSystemProgramId = new PublicKey(lightSystemProgram);
    const accountCompressionProgramId = new PublicKey(
      accountCompressionProgram
    );
    const noopProgramId = new PublicKey(noopProgram);

    // Build remaining accounts for CpiAccounts v1 (default config, no optional accounts)
    // Order matches CompressionCpiAccountIndex enum (skipping optional sol_pool_pda, decompression_recipient, cpi_context)
    const remainingAccounts = [
      {
        pubkey: lightSystemProgramId.toBase58(),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: walletPubkey.toBase58(),
        isWritable: true,
        isSigner: true,
      }, // authority = fee_payer
      {
        pubkey: staticAccounts.registeredProgramPda.toBase58(),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: noopProgramId.toBase58(),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: staticAccounts.accountCompressionAuthority.toBase58(),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: accountCompressionProgramId.toBase58(),
        isWritable: false,
        isSigner: false,
      },
      {
        pubkey: PROGRAM_ID.toBase58(),
        isWritable: false,
        isSigner: false,
      }, // invoking program
      {
        pubkey: "11111111111111111111111111111111",
        isWritable: false,
        isSigner: false,
      }, // system program
      // Tree accounts:
      {
        pubkey: treeAccounts.merkleTree.toBase58(),
        isWritable: true,
        isSigner: false,
      }, // state tree [0]
      {
        pubkey: treeAccounts.nullifierQueue.toBase58(),
        isWritable: true,
        isSigner: false,
      }, // nullifier queue [1]
      {
        pubkey: treeAccounts.addressTree.toBase58(),
        isWritable: true,
        isSigner: false,
      }, // address tree [2]
      {
        pubkey: treeAccounts.addressQueue.toBase58(),
        isWritable: true,
        isSigner: false,
      }, // address queue [3]
    ];

    if (!validityProof.compressedProof) {
      return NextResponse.json(
        { error: "Failed to get compressed proof from indexer" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      proof: {
        a: Array.from(validityProof.compressedProof.a),
        b: Array.from(validityProof.compressedProof.b),
        c: Array.from(validityProof.compressedProof.c),
      },
      addressTreeInfo: {
        addressMerkleTreePubkeyIndex,
        addressQueuePubkeyIndex,
        rootIndex: addressRootIndex,
      },
      outputTreeIndex,
      remainingAccounts,
      postCount,
    });
  } catch (err: unknown) {
    console.error("Compressed post API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to prepare compressed post: ${message}` },
      { status: 500 }
    );
  }
}
