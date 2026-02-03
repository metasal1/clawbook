import { Keypair } from "@solana/web3.js";
import * as nacl from "tweetnacl";

/**
 * Number of signatures required to prove bot status
 * Must complete all within the time window
 */
export const REQUIRED_SIGNATURES = 3;

/**
 * Maximum time (ms) allowed to complete all signatures
 * Humans can't sign 3 messages in <500ms (wallet popup each time)
 */
export const MAX_TIME_WINDOW_MS = 500;

/**
 * Challenge message format
 */
export interface BotChallenge {
  handle: string;
  nonce: number;
  timestamp: number;
}

/**
 * Signed challenge proof
 */
export interface BotProof {
  challenges: BotChallenge[];
  signatures: Uint8Array[];
  publicKey: Uint8Array;
  totalTimeMs: number;
}

/**
 * Generate a challenge message for signing
 */
export function generateChallengeMessage(challenge: BotChallenge): Uint8Array {
  const message = `clawbook:bot:${challenge.handle}:${challenge.nonce}:${challenge.timestamp}`;
  return new TextEncoder().encode(message);
}

/**
 * Generate bot proof by rapidly signing multiple challenges
 * This proves programmatic access to the private key
 */
export async function generateBotProof(
  wallet: Keypair,
  handle: string
): Promise<BotProof> {
  const challenges: BotChallenge[] = [];
  const signatures: Uint8Array[] = [];
  
  const startTime = Date.now();

  // Sign REQUIRED_SIGNATURES messages as fast as possible
  for (let i = 0; i < REQUIRED_SIGNATURES; i++) {
    const challenge: BotChallenge = {
      handle,
      nonce: i,
      timestamp: Date.now(),
    };
    
    const message = generateChallengeMessage(challenge);
    const signature = nacl.sign.detached(message, wallet.secretKey);
    
    challenges.push(challenge);
    signatures.push(signature);
  }

  const totalTimeMs = Date.now() - startTime;

  return {
    challenges,
    signatures,
    publicKey: wallet.publicKey.toBytes(),
    totalTimeMs,
  };
}

/**
 * Verify a bot proof
 * Checks:
 * 1. All signatures are valid
 * 2. Signatures were created within the time window
 * 3. Handle matches across all challenges
 * 4. Nonces are sequential
 */
export function verifyBotProof(proof: BotProof): {
  valid: boolean;
  reason?: string;
} {
  // Check time window
  if (proof.totalTimeMs > MAX_TIME_WINDOW_MS) {
    return {
      valid: false,
      reason: `Signing took ${proof.totalTimeMs}ms, max allowed is ${MAX_TIME_WINDOW_MS}ms`,
    };
  }

  // Check we have enough signatures
  if (proof.signatures.length < REQUIRED_SIGNATURES) {
    return {
      valid: false,
      reason: `Only ${proof.signatures.length} signatures, need ${REQUIRED_SIGNATURES}`,
    };
  }

  // Verify each signature
  const handle = proof.challenges[0]?.handle;
  
  for (let i = 0; i < REQUIRED_SIGNATURES; i++) {
    const challenge = proof.challenges[i];
    const signature = proof.signatures[i];

    // Check handle consistency
    if (challenge.handle !== handle) {
      return {
        valid: false,
        reason: `Handle mismatch at challenge ${i}`,
      };
    }

    // Check nonce sequence
    if (challenge.nonce !== i) {
      return {
        valid: false,
        reason: `Invalid nonce at challenge ${i}`,
      };
    }

    // Verify signature
    const message = generateChallengeMessage(challenge);
    const valid = nacl.sign.detached.verify(message, signature, proof.publicKey);
    
    if (!valid) {
      return {
        valid: false,
        reason: `Invalid signature at challenge ${i}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Encode bot proof for on-chain storage or API submission
 */
export function encodeBotProof(proof: BotProof): string {
  return Buffer.from(
    JSON.stringify({
      challenges: proof.challenges,
      signatures: proof.signatures.map((s) => Buffer.from(s).toString("base64")),
      publicKey: Buffer.from(proof.publicKey).toString("base64"),
      totalTimeMs: proof.totalTimeMs,
    })
  ).toString("base64");
}

/**
 * Decode bot proof from encoded string
 */
export function decodeBotProof(encoded: string): BotProof {
  const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
  return {
    challenges: json.challenges,
    signatures: json.signatures.map((s: string) =>
      Uint8Array.from(Buffer.from(s, "base64"))
    ),
    publicKey: Uint8Array.from(Buffer.from(json.publicKey, "base64")),
    totalTimeMs: json.totalTimeMs,
  };
}

export default {
  generateBotProof,
  verifyBotProof,
  encodeBotProof,
  decodeBotProof,
  REQUIRED_SIGNATURES,
  MAX_TIME_WINDOW_MS,
};
