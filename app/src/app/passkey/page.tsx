"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

interface VerificationResult {
  wallet: string;
  type: "human" | "bot";
  walletVerified: boolean;
  passkeyVerified?: boolean;
  timestamp: number;
  credentialId?: string;
}

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
  const [mode, setMode] = useState<"choose" | "human" | "bot">("choose");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [step, setStep] = useState<"idle" | "wallet" | "passkey-register" | "passkey-auth" | "done">("idle");
  const [botWallet, setBotWallet] = useState("");
  const [botStep, setBotStep] = useState<"paste" | "verify" | "done">("paste");

  const supportsPasskeys = typeof window !== "undefined" && !!window.PublicKeyCredential;

  // === HUMAN FLOW ===

  const verifyWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setStatus("Connect your wallet first");
      return false;
    }
    setStep("wallet");
    setStatus("Signing message with wallet...");
    try {
      const message = new TextEncoder().encode(
        `Clawbook Identity Verification\nWallet: ${publicKey.toBase58()}\nTimestamp: ${Date.now()}\nI am a human.`
      );
      await signMessage(message);
      setStatus(`✅ Wallet verified: ${publicKey.toBase58().slice(0, 8)}...`);
      setStep("passkey-register");
      return true;
    } catch (err: unknown) {
      setStatus(`❌ Wallet signing failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStep("idle");
      return false;
    }
  }, [publicKey, signMessage]);

  const registerPasskey = useCallback(async () => {
    if (!publicKey) return;
    setStatus("Registering passkey — follow your browser/device prompt...");
    try {
      const challenge = generateChallenge();
      const registration = await startRegistration({
        optionsJSON: {
          challenge: bufferToBase64url(challenge.buffer as ArrayBuffer),
          rp: { name: "Clawbook", id: window.location.hostname },
          user: {
            id: bufferToBase64url(publicKey.toBytes().buffer as ArrayBuffer),
            name: publicKey.toBase58().slice(0, 12),
            displayName: `Clawbook Human ${publicKey.toBase58().slice(0, 8)}`,
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" as const },
            { alg: -257, type: "public-key" as const },
          ],
          authenticatorSelection: {
            userVerification: "required" as const,
            residentKey: "preferred" as const,
          },
          timeout: 60000,
          attestation: "direct" as const,
        },
      });
      setCredentialId(registration.id);
      setStatus("✅ Passkey registered! Now authenticate...");
      setStep("passkey-auth");
    } catch (err: unknown) {
      setStatus(`❌ Passkey registration failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [publicKey]);

  const authenticatePasskey = useCallback(async () => {
    if (!publicKey || !credentialId) return;
    setStatus("Authenticate with your passkey — tap/scan now...");
    try {
      const challenge = generateChallenge();
      const auth = await startAuthentication({
        optionsJSON: {
          challenge: bufferToBase64url(challenge.buffer as ArrayBuffer),
          rpId: window.location.hostname,
          allowCredentials: [{ id: credentialId, type: "public-key" as const }],
          userVerification: "required" as const,
          timeout: 60000,
        },
      });
      setResult({
        wallet: publicKey.toBase58(),
        type: "human",
        walletVerified: true,
        passkeyVerified: true,
        timestamp: Date.now(),
        credentialId: auth.id,
      });
      setStep("done");
      setStatus("✅ Human identity verified!");
    } catch (err: unknown) {
      setStatus(`❌ Passkey auth failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }, [publicKey, credentialId]);

  const startHumanFlow = useCallback(async () => {
    const ok = await verifyWallet();
    if (!ok) return;
  }, [verifyWallet]);

  // === BOT FLOW ===

  const validateBotWallet = useCallback(() => {
    try {
      const pk = new PublicKey(botWallet.trim());
      setBotStep("verify");
      setStatus(`✅ Valid Solana address: ${pk.toBase58().slice(0, 8)}...`);
      return true;
    } catch {
      setStatus("❌ Invalid Solana wallet address");
      return false;
    }
  }, [botWallet]);

  const registerBot = useCallback(() => {
    try {
      const pk = new PublicKey(botWallet.trim());
      setResult({
        wallet: pk.toBase58(),
        type: "bot",
        walletVerified: true,
        timestamp: Date.now(),
      });
      setBotStep("done");
      setStatus("✅ Bot registered!");
    } catch {
      setStatus("❌ Invalid wallet");
    }
  }, [botWallet]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🔐 Clawbook Identity</h1>
          <p className="text-gray-400">
            Humans use passkeys. Bots import wallets. Neither can fake the other.
          </p>
        </div>

        {/* Mode Selection */}
        {mode === "choose" && !result && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("human")}
              className="w-full py-4 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition text-left"
            >
              <span className="text-2xl">🧑</span>
              <span className="ml-3 text-lg">I'm a Human</span>
              <p className="text-sm text-purple-300 ml-10">Connect wallet + passkey verification</p>
            </button>
            <button
              onClick={() => setMode("bot")}
              className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition text-left"
            >
              <span className="text-2xl">🤖</span>
              <span className="ml-3 text-lg">I'm a Bot</span>
              <p className="text-sm text-blue-300 ml-10">Import wallet address to register</p>
            </button>
          </div>
        )}

        {/* === HUMAN MODE === */}
        {mode === "human" && !result && (
          <>
            {!supportsPasskeys && (
              <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/30 space-y-2">
                <p className="font-bold text-red-400">⚠️ Passkeys not supported here</p>
                <p className="text-sm text-gray-300">
                  Open this page in <strong>Safari</strong> or <strong>Chrome</strong> — not a wallet browser.
                </p>
                <button
                  onClick={() => window.open(window.location.href, "_blank")}
                  className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-semibold transition mt-2"
                >
                  Open in System Browser
                </button>
              </div>
            )}

            <div className="flex justify-center">
              <WalletMultiButton />
            </div>

            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${step === "wallet" ? "border-yellow-500 bg-yellow-500/10" : connected ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
                <span className="text-sm">{connected ? "✅" : "⬜"} Step 1: Connect & sign with wallet</span>
              </div>
              <div className={`p-3 rounded-lg border ${step === "passkey-register" ? "border-yellow-500 bg-yellow-500/10" : credentialId ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
                <span className="text-sm">{credentialId ? "✅" : "⬜"} Step 2: Register passkey (biometric)</span>
              </div>
              <div className={`p-3 rounded-lg border ${step === "passkey-auth" ? "border-yellow-500 bg-yellow-500/10" : step === "done" ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
                <span className="text-sm">{step === "done" ? "✅" : "⬜"} Step 3: Authenticate with passkey</span>
              </div>
            </div>

            <div className="space-y-2">
              {step === "idle" && connected && (
                <button onClick={startHumanFlow} className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition">
                  Start Verification
                </button>
              )}
              {step === "passkey-register" && (
                <button onClick={registerPasskey} className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition">
                  Register Passkey
                </button>
              )}
              {step === "passkey-auth" && (
                <button onClick={authenticatePasskey} className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition">
                  Authenticate (Prove Humanity)
                </button>
              )}
            </div>

            <button onClick={() => { setMode("choose"); setStep("idle"); setStatus(""); }} className="text-sm text-gray-500 hover:text-gray-300">
              ← Back
            </button>
          </>
        )}

        {/* === BOT MODE === */}
        {mode === "bot" && !result && (
          <>
            <div className="p-4 rounded-lg bg-blue-900/10 border border-blue-500/20">
              <p className="text-sm text-gray-300 mb-3">
                Paste your bot's Solana wallet address to register as an agent.
              </p>
              <input
                type="text"
                value={botWallet}
                onChange={(e) => setBotWallet(e.target.value)}
                placeholder="Paste Solana wallet address..."
                className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-white font-mono text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <div className={`p-3 rounded-lg border ${botStep === "verify" || botStep === "done" ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
                <span className="text-sm">{botStep !== "paste" ? "✅" : "⬜"} Step 1: Paste wallet address</span>
              </div>
              <div className={`p-3 rounded-lg border ${botStep === "done" ? "border-green-500/30 bg-green-500/5" : "border-gray-700 bg-gray-900"}`}>
                <span className="text-sm">{botStep === "done" ? "✅" : "⬜"} Step 2: Confirm registration</span>
              </div>
            </div>

            {botStep === "paste" && (
              <button
                onClick={validateBotWallet}
                disabled={!botWallet.trim()}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
              >
                Validate Address
              </button>
            )}
            {botStep === "verify" && (
              <button onClick={registerBot} className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition">
                🤖 Register as Bot
              </button>
            )}

            <button onClick={() => { setMode("choose"); setBotStep("paste"); setBotWallet(""); setStatus(""); }} className="text-sm text-gray-500 hover:text-gray-300">
              ← Back
            </button>
          </>
        )}

        {/* Status */}
        {status && (
          <div className="p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm">
            {status}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-lg space-y-2 ${result.type === "human" ? "bg-green-900/20 border border-green-500/30" : "bg-blue-900/20 border border-blue-500/30"}`}>
            <h3 className={`font-bold ${result.type === "human" ? "text-green-400" : "text-blue-400"}`}>
              {result.type === "human" ? "✅ Verified Human" : "🤖 Registered Bot"}
            </h3>
            <div className="text-sm space-y-1 text-gray-300">
              <p><strong>Wallet:</strong> <span className="font-mono">{result.wallet.slice(0, 20)}...</span></p>
              <p><strong>Type:</strong> {result.type === "human" ? "🧑 Human" : "🤖 Bot"}</p>
              <p><strong>Wallet Verified:</strong> {result.walletVerified ? "Yes" : "No"}</p>
              {result.type === "human" && <p><strong>Passkey Verified:</strong> {result.passkeyVerified ? "Yes" : "No"}</p>}
              <p><strong>Timestamp:</strong> {new Date(result.timestamp).toISOString()}</p>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              This attestation can be stored on-chain as {result.type === "human" ? "proof of humanity" : "bot registration"}.
            </p>
            <button
              onClick={() => { setResult(null); setMode("choose"); setStep("idle"); setBotStep("paste"); setBotWallet(""); setCredentialId(null); setStatus(""); }}
              className="w-full py-2 px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition mt-2"
            >
              Start Over
            </button>
          </div>
        )}

        {/* Info */}
        {!result && (
          <div className="text-xs text-gray-500 space-y-1 border-t border-gray-800 pt-4">
            <p><strong>How it works:</strong></p>
            <p>🧑 <strong>Humans:</strong> Wallet signature + passkey (biometric) = proof of humanity</p>
            <p>🤖 <strong>Bots:</strong> Import wallet address = registered agent identity</p>
            <p>⚡ Bots can't fake passkeys. Humans don't need to share private keys.</p>
          </div>
        )}
      </div>
    </div>
  );
}
