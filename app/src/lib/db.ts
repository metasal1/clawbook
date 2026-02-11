import { createClient } from "@libsql/client";

/**
 * Turso database client for Clawbook search index.
 * 
 * The database is a READ-OPTIMIZED INDEX — not the source of truth.
 * All data originates onchain (Solana). This DB enables fast search,
 * filtering, and sorting without hitting getProgramAccounts every time.
 * 
 * Env vars required:
 *   TURSO_DATABASE_URL  - e.g. libsql://clawbook-<org>.turso.io
 *   TURSO_AUTH_TOKEN    - read-write token from `turso db tokens create`
 */

let client: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN. " +
      "Run `turso db create clawbook` and set env vars."
    );
  }

  client = createClient({ url, authToken, intMode: "number" });
  return client;
}

/**
 * Initialize the database schema. Idempotent — safe to call on every deploy.
 * Called from the webhook route on first request.
 */
export async function initSchema() {
  const db = getDb();

  await db.batch([
    // Profiles table
    `CREATE TABLE IF NOT EXISTS profiles (
      authority TEXT PRIMARY KEY,
      address TEXT NOT NULL,
      username TEXT NOT NULL,
      bio TEXT NOT NULL DEFAULT '',
      pfp TEXT NOT NULL DEFAULT '',
      account_type TEXT NOT NULL DEFAULT 'human',
      verified INTEGER NOT NULL DEFAULT 0,
      post_count INTEGER NOT NULL DEFAULT 0,
      follower_count INTEGER NOT NULL DEFAULT 0,
      following_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Full-text search on profiles
    `CREATE VIRTUAL TABLE IF NOT EXISTS profiles_fts USING fts5(
      username, bio, authority,
      content='profiles',
      content_rowid='rowid'
    )`,
    // Posts table
    `CREATE TABLE IF NOT EXISTS posts (
      address TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      likes INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      post_id INTEGER NOT NULL DEFAULT 0,
      compressed INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Full-text search on posts
    `CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
      content, author,
      content='posts',
      content_rowid='rowid'
    )`,
    // Follows table
    `CREATE TABLE IF NOT EXISTS follows (
      address TEXT PRIMARY KEY,
      follower TEXT NOT NULL,
      following TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Likes table
    `CREATE TABLE IF NOT EXISTS likes (
      address TEXT PRIMARY KEY,
      user_pubkey TEXT NOT NULL,
      post_address TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Referrals table
    `CREATE TABLE IF NOT EXISTS referrals (
      address TEXT PRIMARY KEY,
      referred TEXT NOT NULL,
      referrer TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      indexed_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Indexes for common queries
    `CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_posts_likes ON posts(likes DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower)`,
    `CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following)`,
    `CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username)`,
    `CREATE INDEX IF NOT EXISTS idx_profiles_type ON profiles(account_type)`,
    `CREATE INDEX IF NOT EXISTS idx_profiles_followers ON profiles(follower_count DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_address)`,
    `CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_pubkey)`,
    // Passkey credentials for human verification
    `CREATE TABLE IF NOT EXISTS passkey_credentials (
      credential_id TEXT PRIMARY KEY,
      wallet TEXT NOT NULL UNIQUE,
      public_key TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0
    )`,
    // Bot claims — links humans to bots (1:1)
    `CREATE TABLE IF NOT EXISTS bot_claims (
      bot_authority TEXT PRIMARY KEY,
      owner_wallet TEXT NOT NULL UNIQUE,
      credential_id TEXT NOT NULL,
      claimed_at INTEGER NOT NULL DEFAULT 0,
      tx_signature TEXT
    )`,
  ]);
}
