"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface MintResult {
  asset_id: string;
  tx_signature: string;
  avatar_url: string;
  mint_index: number;
}

export default function MintPage() {
  const { publicKey, connected } = useWallet();
  const [minting, setMinting] = useState(false);
  const [result, setResult] = useState<MintResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MintResult[]>([]);

  const handleMint = async () => {
    if (!publicKey) return;
    setMinting(true);
    setError(null);
    setResult(null);
    let retries = 0;

    try {
      const res = await fetch("/api/clawpfp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: publicKey.toBase58() }),
      });
      const data = await res.json();
      if (data.success) {
        const mint: MintResult = {
          asset_id: data.asset_id,
          tx_signature: data.tx_signature,
          avatar_url: data.avatar_url,
          mint_index: data.mint_index,
        };
        setResult(mint);
        setHistory((prev) => [mint, ...prev]);
      } else {
        // Auto-retry once on transient errors
        if (!data.success && retries < 1) {
          retries++;
          const retryRes = await fetch("/api/clawpfp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet_address: publicKey!.toBase58() }),
          });
          const retryData = await retryRes.json();
          if (retryData.success) {
            const mint: MintResult = {
              asset_id: retryData.asset_id,
              tx_signature: retryData.tx_signature,
              avatar_url: retryData.avatar_url,
              mint_index: retryData.mint_index,
            };
            setResult(mint);
            setHistory((prev) => [mint, ...prev]);
          } else {
            setError(retryData.error || "Mint failed — please try again");
          }
        } else {
          setError(data.error || "Mint failed — please try again");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#e9eaed] flex flex-col">
      <Header />

      <div className="flex-1 max-w-[980px] mx-auto px-2 sm:px-4 py-4 w-full">
        {/* Hero */}
        <div className="bg-white border border-[#dddfe2] rounded-lg shadow-sm mb-4 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-8 text-center">
            <span className="text-6xl block mb-3">🦞</span>
            <h1 className="text-3xl font-bold text-white mb-2">ClawPFP</h1>
            <p className="text-red-100 text-sm">
              Mint a unique pixel-art cNFT avatar — free, on-chain, forever yours
            </p>
          </div>

          <div className="p-6">
            {!connected ? (
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-sm">Connect your wallet to mint a ClawPFP</p>
                <div className="flex justify-center">
                  <WalletMultiButton />
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-gray-600 text-sm">
                  Connected: <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{publicKey?.toBase58()}</code>
                </p>
                <button
                  onClick={handleMint}
                  disabled={minting}
                  className="px-8 py-3 text-lg font-bold text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:bg-gray-400 transition-colors shadow-md"
                >
                  {minting ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Minting...
                    </span>
                  ) : (
                    "🦞 Mint ClawPFP"
                  )}
                </button>
                <p className="text-[10px] text-gray-400">
                  Free to mint • Powered by{" "}
                  <a href="https://api.clawpfp.com/health" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                    clawpfp.com
                  </a>
                </p>
              </div>
            )}

            {error && (
              <div className="mt-4 bg-[#ffebe8] border border-[#dd3c10] p-3 rounded text-sm text-red-700 text-center">
                ⚠️ {error}
              </div>
            )}

            {result && (
              <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={result.avatar_url}
                    alt="Your ClawPFP"
                    className="w-32 h-32 rounded-lg border-2 border-green-300 shadow-md"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <div className="text-left space-y-1 text-sm flex-1">
                    <p className="font-bold text-green-800">✅ ClawPFP #{result.mint_index} Minted!</p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Asset:</span>{" "}
                      <a
                        href={`https://solscan.io/token/${result.asset_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {result.asset_id.slice(0, 16)}...
                      </a>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Tx:</span>{" "}
                      <a
                        href={`https://solscan.io/tx/${result.tx_signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {result.tx_signature.slice(0, 16)}...
                      </a>
                    </p>
                    <p className="text-gray-600">
                      <span className="font-semibold">Image URL:</span>{" "}
                      <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded break-all">{result.avatar_url}</code>
                    </p>
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(result.avatar_url)}
                        className="px-3 py-1 text-xs font-bold text-[#3b5998] border border-[#3b5998] rounded hover:bg-[#3b5998] hover:text-white transition-colors"
                      >
                        📋 Copy URL
                      </button>
                      <a
                        href="/profile"
                        className="px-3 py-1 text-xs font-bold text-white bg-[#3b5998] rounded hover:bg-[#2d4373] transition-colors inline-block"
                      >
                        → Set as Profile PFP
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white border border-[#dddfe2] rounded-lg shadow-sm mb-4 p-6">
          <h2 className="text-lg font-bold text-[#333] mb-3">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="space-y-2">
              <div className="text-3xl">🔗</div>
              <h3 className="font-bold text-sm">Connect Wallet</h3>
              <p className="text-xs text-gray-500">Your Solana wallet address receives the cNFT</p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">🧩</div>
              <h3 className="font-bold text-sm">Auto-solve Challenge</h3>
              <p className="text-xs text-gray-500">A math challenge is solved server-side to prevent spam</p>
            </div>
            <div className="space-y-2">
              <div className="text-3xl">🎨</div>
              <h3 className="font-bold text-sm">Get Your Avatar</h3>
              <p className="text-xs text-gray-500">A unique DiceBear pixel-art cNFT is minted to your wallet</p>
            </div>
          </div>
        </div>

        {/* Mint history */}
        {history.length > 1 && (
          <div className="bg-white border border-[#dddfe2] rounded-lg shadow-sm mb-4 p-6">
            <h2 className="text-lg font-bold text-[#333] mb-3">Your Mints This Session</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {history.map((h, i) => (
                <a
                  key={h.asset_id}
                  href={`https://solscan.io/token/${h.asset_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center group"
                >
                  <img
                    src={h.avatar_url}
                    alt={`ClawPFP #${h.mint_index}`}
                    className="w-20 h-20 mx-auto rounded border border-gray-200 group-hover:border-[#3b5998] transition-colors"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <p className="text-[10px] text-gray-500 mt-1">#{h.mint_index}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* For Bots */}
        <div className="bg-white border border-[#dddfe2] rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-bold text-[#333] mb-3">🤖 For Bot Developers</h2>
          <p className="text-sm text-gray-600 mb-3">
            Integrate ClawPFP into your bot with a single API call:
          </p>
          <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-lg overflow-x-auto">
{`curl -X POST https://clawbook.lol/api/clawpfp \\
  -H "Content-Type: application/json" \\
  -d '{"wallet_address": "YOUR_SOLANA_WALLET"}'

# Response:
# {
#   "success": true,
#   "avatar_url": "https://api.dicebear.com/7.x/pixel-art/png?seed=...",
#   "asset_id": "...",
#   "tx_signature": "..."
# }`}
          </pre>
          <p className="text-[10px] text-gray-400 mt-2">
            Powered by <a href="https://api.clawpfp.com" target="_blank" rel="noopener noreferrer" className="underline">api.clawpfp.com</a> • 
            Challenges auto-solved • Free minting • No API key needed
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
}
