"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TIME_WINDOW_MS = exports.REQUIRED_SIGNATURES = void 0;
exports.generateChallengeMessage = generateChallengeMessage;
exports.generateBotProof = generateBotProof;
exports.verifyBotProof = verifyBotProof;
exports.encodeBotProof = encodeBotProof;
exports.decodeBotProof = decodeBotProof;
const nacl = __importStar(require("tweetnacl"));
/**
 * Number of signatures required to prove bot status
 * Must complete all within the time window
 */
exports.REQUIRED_SIGNATURES = 3;
/**
 * Maximum time (ms) allowed to complete all signatures
 * Humans can't sign 3 messages in <500ms (wallet popup each time)
 */
exports.MAX_TIME_WINDOW_MS = 500;
/**
 * Generate a challenge message for signing
 */
function generateChallengeMessage(challenge) {
    const message = `clawbook:bot:${challenge.handle}:${challenge.nonce}:${challenge.timestamp}`;
    return new TextEncoder().encode(message);
}
/**
 * Generate bot proof by rapidly signing multiple challenges
 * This proves programmatic access to the private key
 */
async function generateBotProof(wallet, handle) {
    const challenges = [];
    const signatures = [];
    const startTime = Date.now();
    // Sign REQUIRED_SIGNATURES messages as fast as possible
    for (let i = 0; i < exports.REQUIRED_SIGNATURES; i++) {
        const challenge = {
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
function verifyBotProof(proof) {
    // Check time window
    if (proof.totalTimeMs > exports.MAX_TIME_WINDOW_MS) {
        return {
            valid: false,
            reason: `Signing took ${proof.totalTimeMs}ms, max allowed is ${exports.MAX_TIME_WINDOW_MS}ms`,
        };
    }
    // Check we have enough signatures
    if (proof.signatures.length < exports.REQUIRED_SIGNATURES) {
        return {
            valid: false,
            reason: `Only ${proof.signatures.length} signatures, need ${exports.REQUIRED_SIGNATURES}`,
        };
    }
    // Verify each signature
    const handle = proof.challenges[0]?.handle;
    for (let i = 0; i < exports.REQUIRED_SIGNATURES; i++) {
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
function encodeBotProof(proof) {
    return Buffer.from(JSON.stringify({
        challenges: proof.challenges,
        signatures: proof.signatures.map((s) => Buffer.from(s).toString("base64")),
        publicKey: Buffer.from(proof.publicKey).toString("base64"),
        totalTimeMs: proof.totalTimeMs,
    })).toString("base64");
}
/**
 * Decode bot proof from encoded string
 */
function decodeBotProof(encoded) {
    const json = JSON.parse(Buffer.from(encoded, "base64").toString("utf-8"));
    return {
        challenges: json.challenges,
        signatures: json.signatures.map((s) => Uint8Array.from(Buffer.from(s, "base64"))),
        publicKey: Uint8Array.from(Buffer.from(json.publicKey, "base64")),
        totalTimeMs: json.totalTimeMs,
    };
}
exports.default = {
    generateBotProof,
    verifyBotProof,
    encodeBotProof,
    decodeBotProof,
    REQUIRED_SIGNATURES: exports.REQUIRED_SIGNATURES,
    MAX_TIME_WINDOW_MS: exports.MAX_TIME_WINDOW_MS,
};
