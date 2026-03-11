import { Keypair } from "@solana/web3.js";
/**
 * Number of signatures required to prove bot status
 * Must complete all within the time window
 */
export declare const REQUIRED_SIGNATURES = 3;
/**
 * Maximum time (ms) allowed to complete all signatures
 * Humans can't sign 3 messages in <500ms (wallet popup each time)
 */
export declare const MAX_TIME_WINDOW_MS = 500;
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
export declare function generateChallengeMessage(challenge: BotChallenge): Uint8Array;
/**
 * Generate bot proof by rapidly signing multiple challenges
 * This proves programmatic access to the private key
 */
export declare function generateBotProof(wallet: Keypair, handle: string): Promise<BotProof>;
/**
 * Verify a bot proof
 * Checks:
 * 1. All signatures are valid
 * 2. Signatures were created within the time window
 * 3. Handle matches across all challenges
 * 4. Nonces are sequential
 */
export declare function verifyBotProof(proof: BotProof): {
    valid: boolean;
    reason?: string;
};
/**
 * Encode bot proof for on-chain storage or API submission
 */
export declare function encodeBotProof(proof: BotProof): string;
/**
 * Decode bot proof from encoded string
 */
export declare function decodeBotProof(encoded: string): BotProof;
declare const _default: {
    generateBotProof: typeof generateBotProof;
    verifyBotProof: typeof verifyBotProof;
    encodeBotProof: typeof encodeBotProof;
    decodeBotProof: typeof decodeBotProof;
    REQUIRED_SIGNATURES: number;
    MAX_TIME_WINDOW_MS: number;
};
export default _default;
