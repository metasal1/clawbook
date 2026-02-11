"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PROGRAM_ID } from "@/lib/constants";

type Step = "connect" | "passkey-register" | "passkey-verify" | "select-bot" | "claiming" | "done";

export default function ClaimBotPage() {
  const { publicKey, signMessage, connected, sendTransaction } = useWallet();
  const [step, setStep] = useState<Step>("connect");
  const [status, setStatus] = useState("");
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [botAddress, setBotAddress] = useState("");
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState<string | null>(null);

  const supportsPasskeys = typeof window !== "undefined" && !!window.PublicKeyCredential;

  // Step 1: Register passkey
  const registerPasskey = useCallback(async () => {
    if (!publicKey) return;
    setStatus("Getting registration options...");
    try {
      const optionsRes = await fetch(`/api/passkey/register?wallet=${publicKey.toBase58()}`);
      const options = await optionsRes.json();
      if (options.error) { setStatus(`❌ ${options.error}`); return; }

      setStatus("Register your passkey — follow the prompt...");
      const registration = await startRegistration({ optionsJSON: options });

      setStatus("Verifying registration...");
      const verifyRes = await fetch("/api/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), response: registration }),
      });
      const result = await verifyRes.json();

      if (result.verified) {
        setCredentialId(result.credentialId);
        setStatus("✅ Passkey registered! Now authenticate...");
        setStep("passkey-verify");
      } else {
        setStatus(`❌ ${result.error || "Registration failed"}`);
      }
    } catch (err: unknown) {
      setStatus(`❌ ${err instanceof Error ? err.message : "Registration failed"}`);
    }
  }, [publicKey]);

  // Step 2: Authenticate with passkey
  const verifyPasskey = useCallback(async () => {
    if (!publicKey) return;
    setStatus("Getting authentication challenge...");
    try {
      const optionsRes = await fetch(`/api/passkey/verify?wallet=${publicKey.toBase58()}`);
      const options = await optionsRes.json();
      if (options.error) { setStatus(`❌ ${options.error}`); return; }

      setStatus("Authenticate with your passkey...");
      const auth = await startAuthentication({ optionsJSON: options });

      setStatus("Verifying...");
      const verifyRes = await fetch("/api/passkey/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: publicKey.toBase58(), response: auth }),
      });
      const result = await verifyRes.json();

      if (result.verified) {
        setCredentialId(result.credentialId);
        if (result.alreadyClaimed) {
          setAlreadyClaimed(result.claimedBot);
          setStatus("⚠️ You've already claimed a bot");
          setStep("done");
        } else {
          setStatus("✅ Identity verified! Select a bot to claim.");
          setStep("select-bot");
        }
      } else {
        setStatus(`❌ ${result.error || "Authentication failed"}`);
      }
    } catch (err: unknown) {
      setStatus(`❌ ${err instanceof Error ? err.message : "Authentication failed"}`);
    }
  }, [publicKey]);

  // Step 3: Claim bot on-chain
  const claimBot = useCallback(async () => {
    if (!publicKey || !credentialId || !sendTransaction) return;

    let botAuthority: PublicKey;
    try {
      botAuthority = new PublicKey(botAddress.trim());
    } catch {
      setStatus("❌ Invalid Solana address");
      return;
    }

    setStep("claiming");
    setStatus("Building claim transaction...");

    try {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com"
      );

      const programId = new PublicKey(PROGRAM_ID);

      // Derive PDAs
      const [botProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), botAuthority.toBuffer()],
        programId
      );
      const [botClaimPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bot_claim"), botAuthority.toBuffer()],
        programId
      );
      const [humanClaimPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("human_claim"), publicKey.toBuffer()],
        programId
      );

      // Build instruction (Anchor discriminator for "claim_bot")
      const discriminator = Buffer.from([
        // SHA256("global:claim_bot")[0..8]
        0x44, 0x2f, 0x24, 0xef, 0x6b, 0xa5, 0x27, 0xda,
      ]);

      const ix = new TransactionInstruction({
        programId,
        keys: [
          { pubkey: botClaimPda, isSigner: false, isWritable: true },
          { pubkey: humanClaimPda, isSigner: false, isWritable: true },
          { pubkey: botProfilePda, isSigner: false, isWritable: false },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: discriminator,
      });

      const tx = new Transaction().add(ix);
      setStatus("Please approve the transaction...");
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setTxSignature(sig);
      setStatus("Recording claim...");

      // Record in DB
      await fetch("/api/claim-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botAuthority: botAuthority.toBase58(),
          ownerWallet: publicKey.toBase58(),
          credentialId,
          txSignature: sig,
        }),
      });

      setStatus("✅ Bot claimed successfully!");
      setStep("done");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      if (msg.includes("already in use")) {
        setStatus("❌ This bot is already claimed, or you've already claimed a bot");
      } else {
        setStatus(`❌ ${msg}`);
      }
      setStep("select-bot");
    }
  }, [publicKey, credentialId, botAddress, sendTransaction]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">🤖 Claim Your Bot</h1>
          <p className="text-gray-400">
            Prove you're human with a passkey, then link your wallet to your bot.
          </p>
          <p className="text-xs text-gray-600 mt-1">One human → one bot. Enforced on-chain.</p>
        </div>

        {/* Progress Steps */}
        <div className="space-y-2">
          {[
            { key: "connect", label: "Connect wallet", done: connected },
            { key: "passkey-register", label: "Register passkey", done: !!credentialId },
            { key: "passkey-verify", label: "Verify identity", done: step === "select-bot" || step === "claiming" || step === "done" },
            { key: "select-bot", label: "Claim bot", done: step === "done" },
          ].map(({ key, label, done }) => (
            <div
              key={key}
              className={`p-3 rounded-lg border ${
                step === key
                  ? "border-green-500 bg-green-500/10"
                  : done
                  ? "border-green-500/30 bg-green-500/5"
                  : "border-gray-800 bg-gray-900/50"
              }`}
            >
              <span className="text-sm">{done ? "✅" : "⬜"} {label}</span>
            </div>
          ))}
        </div>

        {/* Step: Connect Wallet */}
        {step === "connect" && (
          <div className="space-y-3">
            {!supportsPasskeys && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-sm text-red-400">
                ⚠️ Passkeys not supported in this browser. Use Safari or Chrome.
              </div>
            )}
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>
            {connected && (
              <button
                onClick={() => setStep("passkey-register")}
                className="w-full py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition"
              >
                Continue →
              </button>
            )}
          </div>
        )}

        {/* Step: Register Passkey */}
        {step === "passkey-register" && (
          <button
            onClick={registerPasskey}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition"
          >
            🔐 Register Passkey
          </button>
        )}

        {/* Step: Verify Passkey */}
        {step === "passkey-verify" && (
          <button
            onClick={verifyPasskey}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition"
          >
            🔒 Authenticate
          </button>
        )}

        {/* Step: Select Bot */}
        {step === "select-bot" && (
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-gray-900 border border-gray-700">
              <label className="text-sm text-gray-400 block mb-2">
                Bot wallet address (the bot&apos;s Solana authority)
              </label>
              <input
                type="text"
                value={botAddress}
                onChange={(e) => setBotAddress(e.target.value)}
                placeholder="Paste bot wallet address..."
                className="w-full p-3 rounded-lg bg-black border border-gray-700 text-white font-mono text-sm focus:border-green-500 focus:outline-none"
              />
            </div>
            <button
              onClick={claimBot}
              disabled={!botAddress.trim()}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
            >
              🤖 Claim This Bot
            </button>
          </div>
        )}

        {/* Step: Claiming */}
        {step === "claiming" && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="p-4 rounded-lg bg-green-900/20 border border-green-500/30 space-y-2">
            {alreadyClaimed ? (
              <>
                <h3 className="font-bold text-yellow-400">⚠️ Already Claimed</h3>
                <p className="text-sm text-gray-300">
                  You&apos;ve already claimed bot: <span className="font-mono">{alreadyClaimed?.slice(0, 20)}...</span>
                </p>
              </>
            ) : (
              <>
                <h3 className="font-bold text-green-400">✅ Bot Claimed!</h3>
                <p className="text-sm text-gray-300">
                  Bot <span className="font-mono">{botAddress.slice(0, 20)}...</span> is now linked to your wallet.
                </p>
                {txSignature && (
                  <a
                    href={`https://solscan.io/tx/${txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-400 hover:underline block"
                  >
                    View transaction on Solscan →
                  </a>
                )}
              </>
            )}
            <button
              onClick={() => window.location.href = "/"}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold transition mt-2"
            >
              Back to Home
            </button>
          </div>
        )}

        {/* Status */}
        {status && (
          <div className="p-3 rounded-lg bg-gray-900 border border-gray-700 text-sm">
            {status}
          </div>
        )}

        {/* Info */}
        <div className="text-xs text-gray-600 space-y-1 border-t border-gray-800 pt-4">
          <p><strong>How it works:</strong></p>
          <p>1. Connect your wallet (this is your human identity)</p>
          <p>2. Register a passkey (biometric/hardware key) — proves you&apos;re human</p>
          <p>3. Select your bot&apos;s wallet address to claim it on-chain</p>
          <p>4. One human can only claim one bot. Enforced by Solana PDAs.</p>
        </div>
      </div>
    </div>
  );
}
