"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

export function Faucet() {
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [faucetBalance, setFaucetBalance] = useState<number | null>(null);
  const [result, setResult] = useState<{
    success?: boolean;
    error?: string;
    signature?: string;
    explorer?: string;
  } | null>(null);
  const [manualWallet, setManualWallet] = useState("");

  // Fetch faucet balance
  useEffect(() => {
    async function fetchBalance() {
      try {
        const res = await fetch("/api/faucet");
        const data = await res.json();
        if (data.balance !== undefined) {
          setFaucetBalance(data.balance);
        }
      } catch {}
    }
    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  const requestAirdrop = async () => {
    const wallet = publicKey?.toBase58() || manualWallet.trim();
    if (!wallet) {
      setResult({ error: "Connect your wallet or enter an address" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet }),
      });
      const json = await res.json();

      if (res.ok && json.success) {
        setResult({
          success: true,
          signature: json.signature,
          explorer: json.explorer,
        });
        // Update balance after drip
        if (faucetBalance !== null) {
          setFaucetBalance(Math.max(0, faucetBalance - 1));
        }
      } else {
        setResult({ error: json.error || "Request failed" });
      }
    } catch (e: any) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-[#9aafe5] rounded">
      <div className="bg-[#d3dce8] px-3 py-2 border-b border-[#9aafe5] flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#3b5998]">🚰 Devnet Faucet</h2>
        {faucetBalance !== null && (
          <span className="text-[10px] font-mono text-gray-600">
            {faucetBalance.toFixed(2)} SOL left
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-gray-600 mb-2">
          Get SOL to create your profile and start posting. One drip per day.
        </p>

        {/* Balance bar */}
        {faucetBalance !== null && (
          <div className="mb-2">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full transition-all ${
                  faucetBalance > 5 ? "bg-green-500" : faucetBalance > 1 ? "bg-yellow-500" : "bg-red-500"
                }`}
                style={{ width: `${Math.min(100, (faucetBalance / 20) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {!publicKey && (
          <input
            type="text"
            placeholder="Enter wallet address..."
            value={manualWallet}
            onChange={(e) => setManualWallet(e.target.value)}
            className="w-full px-3 py-2 border border-[#9aafe5] rounded text-sm mb-2 bg-[#f7f7f7] focus:outline-none focus:border-[#3b5998]"
          />
        )}

        {publicKey && (
          <div className="text-xs text-gray-500 mb-2 font-mono bg-[#f7f7f7] px-2 py-1 rounded truncate">
            {publicKey.toBase58()}
          </div>
        )}

        <button
          onClick={requestAirdrop}
          disabled={loading || (faucetBalance !== null && faucetBalance < 1)}
          className={`w-full px-3 py-2 rounded text-sm font-bold transition-colors ${
            loading || (faucetBalance !== null && faucetBalance < 1)
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-[#3b5998] text-white hover:bg-[#2d4373] cursor-pointer"
          }`}
        >
          {loading
            ? "Sending..."
            : faucetBalance !== null && faucetBalance < 1
            ? "🚰 Faucet Empty"
            : "💧 Request 1 SOL"}
        </button>

        {result && (
          <div
            className={`mt-2 p-2 rounded text-xs ${
              result.success
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-600 border border-red-200"
            }`}
          >
            {result.success ? (
              <>
                ✅ Sent 1 SOL!{" "}
                <a
                  href={result.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  View transaction ↗
                </a>
              </>
            ) : (
              <>⚠️ {result.error}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
