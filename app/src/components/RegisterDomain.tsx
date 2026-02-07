"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";

function decodeInstruction(base64: string): TransactionInstruction {
  const decoded = JSON.parse(Buffer.from(base64, "base64").toString());
  return new TransactionInstruction({
    keys: decoded.keys.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    programId: new PublicKey(decoded.programId),
    data: Buffer.from(decoded.data),
  });
}

export function RegisterDomain() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [domainName, setDomainName] = useState("");
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [availability, setAvailability] = useState<{
    available: boolean;
    price: any;
    domain: string;
    owner?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function checkAvailability() {
    if (!domainName.trim()) return;
    setChecking(true);
    setError(null);
    setAvailability(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/domain/lookup?domain=${encodeURIComponent(domainName.trim().toLowerCase())}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAvailability(data);
    } catch (e: any) {
      setError(e.message || "Failed to check domain");
    } finally {
      setChecking(false);
    }
  }

  async function registerDomain() {
    if (!publicKey || !signTransaction || !availability?.available) return;
    setRegistering(true);
    setError(null);
    setSuccess(null);

    try {
      // Get registration instructions from AllDomains
      const res = await fetch("/api/domain/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domainName.trim().toLowerCase(),
          publicKey: publicKey.toBase58(),
          durationRate: 1,
        }),
      });

      const data = await res.json();

      if (data.status === "error") {
        throw new Error(data.error || data.msg || "Registration failed");
      }

      if (data.insufficientFunds) {
        throw new Error("Insufficient funds. You need SOL or USDC to register.");
      }

      if (!data.instructionBase64) {
        throw new Error("No instruction returned from API");
      }

      // Decode instructions
      const mainIx = decodeInstruction(data.instructionBase64);
      const preIxs = data.preInstructionsBase64
        ? data.preInstructionsBase64.map(decodeInstruction)
        : [];

      // Get address lookup tables
      let lookupTables: AddressLookupTableAccount[] = [];
      if (data.addressLookupTableAccountsKeys?.length) {
        const accountInfos = await connection.getMultipleAccountsInfo(
          data.addressLookupTableAccountsKeys.map((k: string) => new PublicKey(k))
        );
        lookupTables = accountInfos
          .map((info, i) => {
            if (!info) return null;
            return new AddressLookupTableAccount({
              key: new PublicKey(data.addressLookupTableAccountsKeys[i]),
              state: AddressLookupTableAccount.deserialize(info.data),
            });
          })
          .filter(Boolean) as AddressLookupTableAccount[];
      }

      // Build versioned transaction
      const { blockhash } = await connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [...preIxs, mainIx],
      }).compileToV0Message(lookupTables);

      const tx = new VersionedTransaction(messageV0);
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());

      await connection.confirmTransaction(sig, "confirmed");
      setSuccess(`🎉 ${domainName}.molt registered! Tx: ${sig.slice(0, 12)}...`);
      setAvailability(null);
      setDomainName("");
    } catch (e: any) {
      console.error("Registration error:", e);
      setError(e.message || "Failed to register domain");
    } finally {
      setRegistering(false);
    }
  }

  // Format price display
  function formatPrice(price: any): string {
    if (!price || !Array.isArray(price) || price.length === 0) return "Free";
    // price is array of { mint, pricing }
    const solPrice = price.find((p: any) => p.mint === "So11111111111111111111111111111111111111112");
    if (solPrice) return `${(solPrice.pricing / 1e9).toFixed(4)} SOL`;
    // USDC
    const usdcPrice = price.find((p: any) =>
      p.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    );
    if (usdcPrice) return `$${(usdcPrice.pricing / 1e6).toFixed(2)} USDC`;
    return `${price[0].pricing} tokens`;
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={domainName}
            onChange={(e) => {
              setDomainName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase());
              setAvailability(null);
              setError(null);
              setSuccess(null);
            }}
            placeholder="yourdomain"
            maxLength={32}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-l focus:border-[#ff6b35] focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && checkAvailability()}
          />
        </div>
        <span className="inline-flex items-center px-2 py-1.5 text-sm font-bold text-[#ff6b35] bg-[#fff0e0] border border-l-0 border-gray-300 rounded-r">
          .molt
        </span>
        <button
          onClick={checkAvailability}
          disabled={checking || !domainName.trim()}
          className="px-3 py-1.5 text-sm font-bold text-white bg-[#ff6b35] rounded hover:bg-[#e55a25] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? "..." : "Check"}
        </button>
      </div>

      {/* Availability result */}
      {availability && (
        <div
          className={`p-2 rounded border text-xs ${
            availability.available
              ? "bg-[#d9ffce] border-[#8fbc8f]"
              : "bg-[#ffebe8] border-[#dd3c10]"
          }`}
        >
          {availability.available ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-green-700">
                  ✅ {availability.domain} is available!
                </span>
                <span className="text-gray-600">
                  {formatPrice(availability.price)}
                </span>
              </div>
              {connected ? (
                <button
                  onClick={registerDomain}
                  disabled={registering}
                  className="w-full py-1.5 text-sm font-bold text-white bg-[#ff6b35] rounded hover:bg-[#e55a25] disabled:bg-gray-400 transition-colors"
                >
                  {registering ? "Registering..." : `Register ${availability.domain}`}
                </button>
              ) : (
                <p className="text-gray-600">Connect wallet to register</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              <span className="font-bold text-red-700">
                ❌ {availability.domain} is taken
              </span>
              {availability.owner && (
                <div className="text-gray-600">
                  Owner:{" "}
                  <a
                    href={`https://solscan.io/account/${availability.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3b5998] hover:underline font-mono"
                  >
                    {availability.owner.slice(0, 8)}...{availability.owner.slice(-6)}
                  </a>
                  {" · "}
                  <a
                    href={`/profile/${availability.owner}`}
                    className="text-[#ff6b35] hover:underline"
                  >
                    View Profile →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-[#ffebe8] border border-[#dd3c10] p-2 rounded text-xs text-red-700">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-[#d9ffce] border border-[#8fbc8f] p-2 rounded text-xs text-green-700">
          {success}
        </div>
      )}

      <p className="text-[10px] text-gray-500">
        Powered by{" "}
        <a
          href="https://alldomains.id"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#ff6b35] hover:underline"
        >
          AllDomains ↗
        </a>
        {" · "}
        Payments via{" "}
        <a
          href="https://www.payai.network/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b5998] hover:underline"
        >
          x402 ↗
        </a>
      </p>
    </div>
  );
}
