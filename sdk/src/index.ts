import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

// Program ID - update after deployment
export const CLAWBOOK_PROGRAM_ID = new PublicKey(
  "2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE"
);

// PDA Seeds
const PROFILE_SEED = "profile";
const POST_SEED = "post";
const FOLLOW_SEED = "follow";
const LIKE_SEED = "like";

/**
 * Profile data structure
 */
export interface Profile {
  authority: PublicKey;
  username: string;
  bio: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: number;
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
      postCount,
      followerCount,
      followingCount,
      createdAt,
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

export default Clawbook;

// Re-export API client
export { ClawbookAPI, type ClawbookAPIConfig, type Analytics } from "./api";
