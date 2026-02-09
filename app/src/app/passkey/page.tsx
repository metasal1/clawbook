"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import bs58 from "bs58";

// Types
interface VerificationResult {
  wallet: string;
  walletVerified: boolean;
  passkeyVerified: boolean;
  isHuman: boolean;
  timestamp: number;
  credentialId?: string;
}

// WebAuthn helpers — in production these would be server-side
function generateChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export default function PasskeyPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "wallet" | "passkey-register" | "passkey-auth" | "done">("idle");

  // Step 1: Sign a message with wallet to prove ownership
  const verifyWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setStatus("Connect your wallet first");
      return;
    }

    setStep("wallet");
    setStatus("Signing message with wallet...");

    try {
      const message = new TextEncoder().encode(
        `Clawbook Identity Verification\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}\nI am a human.`
      );
      const signature = await signMessage(message);
      setStatus(`✅ Wallet verified: ${publicKey.toBase58().slice(0, 8)}...`);
      setStep("passkey-register");
      return { wallet: publicKey.toBase58(), signature: bs58.encode(signature) };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ Wallet signing failed: ${errorMessage}`);
      setStep("idle");
      return null;
    }
  }, [publicKey, signMessage]);

  // Step 2: Register a passkey (first time)
  const registerPasskey = useCallback(async () => {
    if (!publicKey) return;

    setStatus("Registering passkey — follow your browser/device prompt...");

    try {
      const challenge = generateChallenge();

      const registrationOptions = {
        challenge: bufferToBase64url(challenge.buffer as ArrayBuffer),
        rp: {
          name: "Clawbook",
          id: window.location.hostname,
        },
        user: {
          id: bufferToBase64url(publicKey.toBytes().buffer as ArrayBuffer),
          name: publicKey.toBase58().slice(0, 12),
          displayName: `Clawbook User ${publicKey.toBase58().slice(0, 8)}`,
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" as const },
          { alg: -257, type: "public-key" as const },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          userVerification: "required" as const,
          residentKey: "required" as const,
        },
        timeout: 60000,
        attestation: "direct" as const,
      };

      const registration = await startRegistration({ optionsJSON: registrationOptions });
      const credId = registration.id;
      setCredentialId(credId);

      setStatus("✅ Passkey registered! Now authenticate to prove you're human...");
      setStep("passkey-auth");
      return credId;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ Passkey registration failed: ${errorMessage}`);
      setStep("passkey-register");
      return null;
    }
  }, [publicKey]);

  // Step 3: Authenticate with passkey (proves physical presence)
  const authenticatePasskey = useCallback(async () => {
    if (!publicKey || !credentialId) return;

    setStatus("Authenticate with your passkey — tap/scan now...");

    try {
      const challenge = generateChallenge();

      const authOptions = {
        challenge: bufferToBase64url(challenge.buffer as ArrayBuffer),
        rpId: window.location.hostname,
        allowCredentials: [
          {
            id: credentialId,
            type: "public-key" as const,
            transports: ["internal" as const],
          },
        ],
        userVerification: "required" as const,
        timeout: 60000,
      };

      const authentication = await startAuthentication({ optionsJSON: authOptions });

      // Both wallet + passkey verified
      const verificationResult: VerificationResult = {
        wallet: publicKey.toBase58(),
        walletVerified: true,
        passkeyVerified: true,
        isHuman: true,
        timestamp: Date.now(),
        credentialId: authentication.id,
      };

      setResult(verificationResult);
      setStep("done");
      setStatus("✅ Identity verified! Wallet + Passkey confirmed.");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setStatus(`❌ Passkey auth failed: ${errorMessage}`);
      setStep("passkey-auth");
    }
  }, [publicKey, credentialId]);

  // Full flow
  const startVerification = useCallback(async () => {
    const walletResult = await verifyWallet();
    if (!walletResult) return;
  }, [verifyWallet]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🔐 Clawbook Identity</h1>
          <p className="text-gray-400">
            Wallet signature + Passkey = Proof of humanity
          </p>
        </div>

        {/* Wallet Connect */}
        <div className="flex justify-center">
          <WalletMultiButton />
        </div>

        {/* Flow Steps */}
        <div className="space-y-3">
          <div className={`p-3 rounded-lg border ${step === "wallet" ? "border-yellow-500 bg-yellow-500/10" : connected ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
            <span className="text-sm">
              {connected ? "✅" : "⬜"} Step 1: Connect & sign with wallet
            </span>
          </div>
          <div className={`p-3 rounded-lg border ${step === "passkey-register" ? "border-yellow-500 bg-yellow-500/10" : credentialId ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
            <span className="text-sm">
              {credentialId ? "✅" : "⬜"} Step 2: Register passkey (biometric/device)
            </span>
          </div>
          <div className={`p-3 rounded-lg border ${step === "passkey-auth" ? "border-yellow-500 bg-yellow-500/10" : result?.passkeyVerified ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
            <span className="text-sm">
              {result?.passkeyVerified ? "✅" : "⬜"} Step 3: Authenticate with passkey
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {step === "idle" && connected && (
            <button
              onClick={startVerification}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition"
            >
              Start Verification
            </button>
          )}
          {step === "passkey-register" && (
            <button
              onClick={registerPasskey}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
            >
              Register Passkey
            </button>
          )}
          {step === "passkey-auth" && (
            <button
              onClick={authenticatePasskey}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
            >
              Authenticate (Prove Humanity)
            </button>
          )}
        </div>

        {/* Status */}
        {status && (
          <div className="p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm">
            {status}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/30 space-y-2">
            <h3 className="font-bold text-green-400">✅ Verified Human</h3>
            <div className="text-sm space-y-1 text-gray-300">
              <p><strong>Wallet:</strong> {result.wallet.slice(0, 16)}...</p>
              <p><strong>Wallet Signed:</strong> {result.walletVerified ? "Yes" : "No"}</p>
              <p><strong>Passkey Verified:</strong> {result.passkeyVerified ? "Yes" : "No"}</p>
              <p><strong>Classification:</strong> {result.isHuman ? "🧑 Human" : "🤖 Bot"}</p>
              <p><strong>Timestamp:</strong> {new Date(result.timestamp).toISOString()}</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This attestation could be stored on-chain as proof of humanity.
            </p>
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-500 space-y-1 border-t border-gray-800 pt-4">
          <p><strong>How it works:</strong></p>
          <p>1. Wallet signature proves you control the private key</p>
          <p>2. Passkey registration binds a hardware authenticator to your wallet</p>
          <p>3. Passkey authentication requires physical presence (biometric/PIN)</p>
          <p>4. Bots can sign with wallets but can't pass passkey challenges</p>
        </div>
      </div>
    </div>
  );
}
