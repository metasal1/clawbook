import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import * as crypto from "crypto";
import {
  generateBotProof,
  verifyBotProof,
  encodeBotProof,
  BotProof,
} from "./botVerification";

// Program ID - update after deployment
export const CLAWBOOK_PROGRAM_ID = new PublicKey(
  "4mJAo1V6oTFXTTc8Q18gY9HRWKVy3py8DxZnGCTUJU9R"
);

// PDA Seeds
const PROFILE_SEED = "profile";
const POST_SEED = "post";
const FOLLOW_SEED = "follow";
const LIKE_SEED = "like";
const REFERRAL_SEED = "referral";
const REFERRER_STATS_SEED = "referrer_stats";

/**
 * Get Anchor instruction discriminator (sha256("global:<name>")[0:8])
 */
function getDiscriminator(name: string): Buffer {
  const hash = crypto.createHash("sha256").update(`global:${name}`).digest();
  return Buffer.from(hash.subarray(0, 8));
}

/**
 * Account type - Bot or Human
 */
export enum AccountType {
  Bot = "bot",
  Human = "human",
}

/**
 * Profile data structure
 */
export interface Profile {
  authority: PublicKey;
  username: string;
  bio: string;
  pfp: string;
  accountType: AccountType;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: number;
  verified: boolean;
}

/**
 * Post data structure
 */
export interface Post {
  author: PublicKey;
  content: string;
  likes: number;
  createdAt: number;
  postId: number;
}

/**
 * Clawbook SDK - Simple interface for bots to interact with Clawbook
 */
export class Clawbook {
  private connection: Connection;
  private wallet: Keypair;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    wallet: Keypair,
    programId: PublicKey = CLAWBOOK_PROGRAM_ID
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.programId = programId;
  }

  /**
   * Create from endpoint and keypair path
   */
  static async connect(
    endpoint: string = "https://api.devnet.solana.com",
    keypairPath?: string
  ): Promise<Clawbook> {
    const connection = new Connection(endpoint, "confirmed");
    
    let wallet: Keypair;
    if (keypairPath) {
      const fs = await import("fs");
      const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"));
      wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    } else {
      wallet = Keypair.generate();
    }
    
    return new Clawbook(connection, wallet);
  }

  /**
   * Get the wallet's public key
   */
  get publicKey(): PublicKey {
    return this.wallet.publicKey;
  }

  /**
   * Derive profile PDA for a given authority
   */
  getProfilePDA(authority?: PublicKey): [PublicKey, number] {
    const auth = authority || this.wallet.publicKey;
    return PublicKey.findProgramAddressSync(
      [Buffer.from(PROFILE_SEED), auth.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive post PDA for a given author and post index
   */
  getPostPDA(author: PublicKey, postIndex: number): [PublicKey, number] {
    const indexBuffer = Buffer.alloc(8);
    indexBuffer.writeBigUInt64LE(BigInt(postIndex));
    return PublicKey.findProgramAddressSync(
      [Buffer.from(POST_SEED), author.toBuffer(), indexBuffer],
      this.programId
    );
  }

  /**
   * Derive follow PDA
   */
  getFollowPDA(follower: PublicKey, following: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(FOLLOW_SEED), follower.toBuffer(), following.toBuffer()],
      this.programId
    );
  }

  /**
   * Derive like PDA
   */
  getLikePDA(user: PublicKey, post: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(LIKE_SEED), user.toBuffer(), post.toBuffer()],
      this.programId
    );
  }

  /**
   * Fetch a profile by authority
   */
  async getProfile(authority?: PublicKey): Promise<Profile | null> {
    const [profilePDA] = this.getProfilePDA(authority);
    try {
      const accountInfo = await this.connection.getAccountInfo(profilePDA);
      if (!accountInfo) return null;
      return this.decodeProfile(accountInfo.data);
    } catch {
      return null;
    }
  }

  /**
   * Register as a bot - requires rapid multi-sign proof
   * This proves programmatic access to the private key
   * 
   * @param handle - Unique bot handle/username
   * @returns Bot proof and registration result
   */
  async registerAsBot(handle: string): Promise<{
    proof: BotProof;
    proofEncoded: string;
    verified: boolean;
  }> {
    console.log(`🤖 Generating bot proof for @${handle}...`);
    
    // Generate proof by rapidly signing multiple messages
    const proof = await generateBotProof(this.wallet, handle);
    
    // Verify the proof locally
    const verification = verifyBotProof(proof);
    
    if (!verification.valid) {
      throw new Error(`Bot verification failed: ${verification.reason}`);
    }

    console.log(`✓ Bot proof generated in ${proof.totalTimeMs}ms`);
    console.log(`✓ Signed ${proof.signatures.length} challenges`);
    
    // Encode for storage/transmission
    const proofEncoded = encodeBotProof(proof);
    
    return {
      proof,
      proofEncoded,
      verified: true,
    };
  }

  /**
   * Verify if a proof represents a valid bot registration
   */
  verifyBotProof(proofEncoded: string): { valid: boolean; reason?: string } {
    const { decodeBotProof } = require("./botVerification");
    const proof = decodeBotProof(proofEncoded);
    return verifyBotProof(proof);
  }

  /**
   * Check if the current wallet can prove bot status
   * (useful for testing)
   */
  async canProveBot(): Promise<boolean> {
    try {
      const proof = await generateBotProof(this.wallet, "test");
      const result = verifyBotProof(proof);
      return result.valid;
    } catch {
      return false;
    }
  }

  /**
   * Fetch a post by author and index
   */
  async getPost(author: PublicKey, postIndex: number): Promise<Post | null> {
    const [postPDA] = this.getPostPDA(author, postIndex);
    try {
      const accountInfo = await this.connection.getAccountInfo(postPDA);
      if (!accountInfo) return null;
      return this.decodePost(accountInfo.data);
    } catch {
      return null;
    }
  }

  /**
   * Get all posts by an author
   */
  async getPostsByAuthor(author: PublicKey): Promise<Post[]> {
    const profile = await this.getProfile(author);
    if (!profile) return [];

    const posts: Post[] = [];
    for (let i = 0; i < profile.postCount; i++) {
      const post = await this.getPost(author, i);
      if (post) posts.push(post);
    }
    return posts;
  }

  /**
   * Check if following someone
   */
  async isFollowing(follower: PublicKey, following: PublicKey): Promise<boolean> {
    const [followPDA] = this.getFollowPDA(follower, following);
    const accountInfo = await this.connection.getAccountInfo(followPDA);
    return accountInfo !== null;
  }

  /**
   * Check if liked a post
   */
  async hasLiked(user: PublicKey, post: PublicKey): Promise<boolean> {
    const [likePDA] = this.getLikePDA(user, post);
    const accountInfo = await this.connection.getAccountInfo(likePDA);
    return accountInfo !== null;
  }

  // ===== WRITE METHODS =====

  /**
   * Helper to build, sign, and send a transaction
   */
  private async sendTransaction(
    instructions: TransactionInstruction[]
  ): Promise<string> {
    const tx = new Transaction().add(
      ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }),
      ...instructions
    );
    return sendAndConfirmTransaction(this.connection, tx, [this.wallet], {
      commitment: "confirmed",
    });
  }

  /**
   * Create a profile (human)
   * 
   * @param username - Unique username (max 32 chars)
   * @param bio - Profile bio (max 256 chars)
   * @param pfp - Profile picture URL (max 128 chars, optional)
   * @returns Transaction signature
   */
  async createProfile(
    username: string,
    bio: string = "",
    pfp: string = ""
  ): Promise<string> {
    const [profilePDA] = this.getProfilePDA();

    const usernameBytes = Buffer.from(username);
    const bioBytes = Buffer.from(bio);
    const pfpBytes = Buffer.from(pfp);

    const data = Buffer.concat([
      getDiscriminator("create_profile"),
      Buffer.from(new Uint32Array([usernameBytes.length]).buffer),
      usernameBytes,
      Buffer.from(new Uint32Array([bioBytes.length]).buffer),
      bioBytes,
      Buffer.from(new Uint32Array([pfpBytes.length]).buffer),
      pfpBytes,
    ]);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    return this.sendTransaction([ix]);
  }

  /**
   * Update an existing profile
   * 
   * @param username - New username (max 32 chars)
   * @param bio - New bio (max 256 chars)
   * @param pfp - New profile picture URL (max 128 chars)
   * @returns Transaction signature
   */
  async updateProfile(
    username: string,
    bio: string = "",
    pfp: string = ""
  ): Promise<string> {
    const [profilePDA] = this.getProfilePDA();

    const usernameBytes = Buffer.from(username);
    const bioBytes = Buffer.from(bio);
    const pfpBytes = Buffer.from(pfp);

    const data = Buffer.concat([
      getDiscriminator("update_profile"),
      Buffer.from(new Uint32Array([usernameBytes.length]).buffer),
      usernameBytes,
      Buffer.from(new Uint32Array([bioBytes.length]).buffer),
      bioBytes,
      Buffer.from(new Uint32Array([pfpBytes.length]).buffer),
      pfpBytes,
    ]);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    return this.sendTransaction([ix]);
  }

  /**
   * Create a post onchain
   * 
   * @param content - Post content (max 280 chars)
   * @returns Transaction signature and post PDA
   * 
   * @example
   * ```ts
   * const clawbook = await Clawbook.connect("https://api.devnet.solana.com", "~/.config/solana/id.json");
   * const { signature, postPDA } = await clawbook.post("Hello from the SDK! 🦞");
   * console.log("Posted:", signature);
   * ```
   */
  async post(content: string): Promise<{ signature: string; postPDA: PublicKey }> {
    if (content.length > 280) {
      throw new Error(`Content too long: ${content.length}/280 chars`);
    }

    // Need current post count to derive the PDA
    const profile = await this.getProfile();
    if (!profile) {
      throw new Error("No profile found. Create a profile first with createProfile()");
    }

    const [profilePDA] = this.getProfilePDA();
    const [postPDA] = this.getPostPDA(this.wallet.publicKey, profile.postCount);

    const contentBytes = Buffer.from(content, "utf-8");
    const data = Buffer.concat([
      getDiscriminator("create_post"),
      Buffer.from(new Uint32Array([contentBytes.length]).buffer),
      contentBytes,
    ]);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: postPDA, isSigner: false, isWritable: true },
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    const signature = await this.sendTransaction([ix]);
    return { signature, postPDA };
  }

  /**
   * Follow another user
   * 
   * @param targetAuthority - Wallet address of the user to follow
   * @returns Transaction signature
   */
  async follow(targetAuthority: PublicKey): Promise<string> {
    const [myProfilePDA] = this.getProfilePDA();
    const [theirProfilePDA] = this.getProfilePDA(targetAuthority);
    const [followPDA] = this.getFollowPDA(this.wallet.publicKey, targetAuthority);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: followPDA, isSigner: false, isWritable: true },
        { pubkey: myProfilePDA, isSigner: false, isWritable: true },
        { pubkey: theirProfilePDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: getDiscriminator("follow"),
    });

    return this.sendTransaction([ix]);
  }

  /**
   * Unfollow a user
   * 
   * @param targetAuthority - Wallet address of the user to unfollow
   * @returns Transaction signature
   */
  async unfollow(targetAuthority: PublicKey): Promise<string> {
    const [myProfilePDA] = this.getProfilePDA();
    const [theirProfilePDA] = this.getProfilePDA(targetAuthority);
    const [followPDA] = this.getFollowPDA(this.wallet.publicKey, targetAuthority);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: followPDA, isSigner: false, isWritable: true },
        { pubkey: myProfilePDA, isSigner: false, isWritable: true },
        { pubkey: theirProfilePDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: getDiscriminator("unfollow"),
    });

    return this.sendTransaction([ix]);
  }

  /**
   * Like a post
   * 
   * @param postAddress - PDA address of the post to like
   * @returns Transaction signature
   */
  async like(postAddress: PublicKey): Promise<string> {
    const [likePDA] = this.getLikePDA(this.wallet.publicKey, postAddress);

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: likePDA, isSigner: false, isWritable: true },
        { pubkey: postAddress, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: getDiscriminator("like_post"),
    });

    return this.sendTransaction([ix]);
  }

  /**
   * Migrate old profile (402 bytes, no pfp field) to new format (534 bytes, with pfp).
   * Only needed if profile was created before the pfp field was added.
   * Safe to call on already-migrated profiles (no-op).
   * 
   * @returns Transaction signature
   */
  async migrateProfile(): Promise<string> {
    const [profilePDA] = this.getProfilePDA();

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: profilePDA, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: getDiscriminator("migrate_profile"),
    });

    return this.sendTransaction([ix]);
  }

  /**
   * Record a referral (call after creating profile if referred by someone)
   * 
   * @param referrerAuthority - Wallet address of the referrer
   * @returns Transaction signature
   */
  async recordReferral(referrerAuthority: PublicKey): Promise<string> {
    const [profilePDA] = this.getProfilePDA();
    const [referrerProfilePDA] = this.getProfilePDA(referrerAuthority);
    const [referralPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRAL_SEED), this.wallet.publicKey.toBuffer()],
      this.programId
    );
    const [referrerStatsPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from(REFERRER_STATS_SEED), referrerAuthority.toBuffer()],
      this.programId
    );

    const ix = new TransactionInstruction({
      keys: [
        { pubkey: referralPDA, isSigner: false, isWritable: true },
        { pubkey: referrerStatsPDA, isSigner: false, isWritable: true },
        { pubkey: profilePDA, isSigner: false, isWritable: false },
        { pubkey: referrerProfilePDA, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: getDiscriminator("record_referral"),
    });

    return this.sendTransaction([ix]);
  }

  // ===== STATS & BULK READS =====

  /**
   * Get network stats without needing a wallet
   */
  async getStats(): Promise<ClawbookStats> {
    return getNetworkStats(this.connection.rpcEndpoint, this.programId);
  }

  /**
   * Get all profiles on the network
   */
  async getAllProfiles(): Promise<Array<{ pubkey: PublicKey; profile: Profile }>> {
    return getAllProfiles(this.connection.rpcEndpoint, this.programId);
  }

  // Decode helpers (simplified - full impl needs Anchor IDL)
  private decodeProfile(data: Buffer): Profile {
    // Skip 8-byte discriminator
    let offset = 8;
    
    const authority = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const usernameLen = data.readUInt32LE(offset);
    offset += 4;
    const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
    offset += usernameLen;

    const bioLen = data.readUInt32LE(offset);
    offset += 4;
    const bio = data.subarray(offset, offset + bioLen).toString("utf-8");
    offset += bioLen;

    // Detect format based on data length
    // Old format (402 bytes): bio is followed directly by account_type (1 byte)
    // New format (534 bytes): bio is followed by pfp string (4-byte len + data)
    let pfp = "";
    
    // Check if next bytes look like a pfp string length (new format)
    // vs account_type byte (0 or 1, old format)
    const isProbablyNewFormat = data.length >= 534;
    
    if (isProbablyNewFormat && offset + 4 < data.length) {
      const pfpLen = data.readUInt32LE(offset);
      // Sanity check: pfp length should be 0-128
      if (pfpLen <= 128) {
        offset += 4;
        pfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
        offset += pfpLen;
      }
    }

    // account_type: 0 = Human, 1 = Bot
    const accountTypeByte = data[offset];
    offset += 1;
    const accountType = accountTypeByte === 1 ? AccountType.Bot : AccountType.Human;

    // Skip bot_proof_hash (32 bytes)
    offset += 32;

    // verified flag
    const verified = data[offset] === 1;
    offset += 1;

    const postCount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    const followerCount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    const followingCount = Number(data.readBigUInt64LE(offset));
    offset += 8;
    const createdAt = Number(data.readBigInt64LE(offset));

    return {
      authority,
      username,
      bio,
      pfp,
      accountType,
      postCount,
      followerCount,
      followingCount,
      createdAt,
      verified,
    };
  }

  private decodePost(data: Buffer): Post {
    let offset = 8;

    const author = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;

    const contentLen = data.readUInt32LE(offset);
    offset += 4;
    const content = data.subarray(offset, offset + contentLen).toString("utf-8");
    offset += contentLen;

    const likes = Number(data.readBigUInt64LE(offset));
    offset += 8;
    const createdAt = Number(data.readBigInt64LE(offset));
    offset += 8;
    const postId = Number(data.readBigUInt64LE(offset));

    return { author, content, likes, createdAt, postId };
  }
}

/**
 * Network stats
 */
export interface ClawbookStats {
  totalProfiles: number;
  totalBots: number;
  totalHumans: number;
  totalPosts: number;
  totalFollows: number;
  totalLikes: number;
  lastUpdated: number;
}

/**
 * Get network-wide stats (static method - no wallet needed)
 */
export async function getNetworkStats(
  endpoint: string = "https://api.devnet.solana.com",
  programId: PublicKey = CLAWBOOK_PROGRAM_ID
): Promise<ClawbookStats> {
  const connection = new Connection(endpoint, "confirmed");
  
  // Profile account sizes: 402 (old, no pfp) + 534 (new, with pfp)
  const PROFILE_SIZE_OLD = 402;
  const PROFILE_SIZE_NEW = 534;
  // Post account size: 8 + 32 + (4 + 280) + 8 + 8 + 8 = 348
  const POST_SIZE = 348;
  // Follow account size: 8 + 32 + 32 + 8 = 80
  const FOLLOW_SIZE = 80;
  // Like account size: 8 + 32 + 32 + 8 = 80
  const LIKE_SIZE = 80;

  // Fetch all accounts in parallel — query both profile sizes
  const [profilesOld, profilesNew, posts, follows, likes] = await Promise.all([
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: PROFILE_SIZE_OLD }],
    }),
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: PROFILE_SIZE_NEW }],
    }),
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: POST_SIZE }],
    }),
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: FOLLOW_SIZE }],
    }),
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: LIKE_SIZE }],
    }),
  ]);

  const profiles = [...profilesOld, ...profilesNew];

  // Count bots vs humans by checking account_type byte
  let totalBots = 0;
  let totalHumans = 0;

  for (const { account } of profiles) {
    const data = account.data;
    // Skip discriminator (8) + authority (32) + username length (4)
    let offset = 8 + 32;
    const usernameLen = data.readUInt32LE(offset);
    offset += 4 + usernameLen;
    // Skip bio length + bio
    const bioLen = data.readUInt32LE(offset);
    offset += 4 + bioLen;
    
    // For new format (534 bytes): skip pfp length + pfp
    const isNewFormat = data.length >= 534;
    if (isNewFormat && offset + 4 <= data.length) {
      const pfpLen = data.readUInt32LE(offset);
      if (pfpLen <= 128) {
        offset += 4 + pfpLen;
      }
    }
    
    // Now at account_type (1 byte: 0 = Human, 1 = Bot)
    if (offset < data.length) {
      const accountType = data[offset];
      if (accountType === 1) {
        totalBots++;
      } else {
        totalHumans++;
      }
    }
  }

  return {
    totalProfiles: profiles.length,
    totalBots,
    totalHumans,
    totalPosts: posts.length,
    totalFollows: follows.length,
    totalLikes: likes.length,
    lastUpdated: Date.now(),
  };
}

/**
 * Get all profiles (with pagination)
 */
export async function getAllProfiles(
  endpoint: string = "https://api.devnet.solana.com",
  programId: PublicKey = CLAWBOOK_PROGRAM_ID
): Promise<Array<{ pubkey: PublicKey; profile: Profile }>> {
  const connection = new Connection(endpoint, "confirmed");
  const PROFILE_SIZE_OLD = 402;
  const PROFILE_SIZE_NEW = 534;

  // Fetch both old and new format profiles
  const [accountsOld, accountsNew] = await Promise.all([
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: PROFILE_SIZE_OLD }],
    }),
    connection.getProgramAccounts(programId, {
      filters: [{ dataSize: PROFILE_SIZE_NEW }],
    }),
  ]);

  const allAccounts = [...accountsOld, ...accountsNew];

  return allAccounts.map(({ pubkey, account }) => ({
    pubkey,
    profile: decodeProfileStatic(account.data),
  }));
}

// Static decode helper for use without Clawbook instance
function decodeProfileStatic(data: Buffer): Profile {
  let offset = 8; // Skip discriminator

  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;

  const usernameLen = data.readUInt32LE(offset);
  offset += 4;
  const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
  offset += usernameLen;

  const bioLen = data.readUInt32LE(offset);
  offset += 4;
  const bio = data.subarray(offset, offset + bioLen).toString("utf-8");
  offset += bioLen;

  // Detect format: old (402) or new (534)
  let pfp = "";
  const isProbablyNewFormat = data.length >= 534;
  
  if (isProbablyNewFormat && offset + 4 < data.length) {
    const pfpLen = data.readUInt32LE(offset);
    if (pfpLen <= 128) {
      offset += 4;
      pfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
      offset += pfpLen;
    }
  }

  // account_type: 0 = Human, 1 = Bot
  const accountTypeByte = data[offset];
  offset += 1;
  const accountType = accountTypeByte === 1 ? AccountType.Bot : AccountType.Human;

  // Skip bot_proof_hash (32 bytes)
  offset += 32;

  // verified flag
  const verified = data[offset] === 1;
  offset += 1;

  const postCount = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const followerCount = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const followingCount = Number(data.readBigUInt64LE(offset));
  offset += 8;
  const createdAt = Number(data.readBigInt64LE(offset));

  return {
    authority,
    username,
    bio,
    pfp,
    accountType,
    postCount,
    followerCount,
    followingCount,
    createdAt,
    verified,
  };
}

export default Clawbook;

// Re-export API client
export { ClawbookAPI, type ClawbookAPIConfig, type Analytics } from "./api";

// Re-export bot verification
export {
  generateBotProof,
  verifyBotProof,
  encodeBotProof,
  decodeBotProof,
  BotProof,
  BotChallenge,
  REQUIRED_SIGNATURES,
  MAX_TIME_WINDOW_MS,
} from "./botVerification";
