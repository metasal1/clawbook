"use client";

import { useState } from "react";

export function SolDomainLookup() {
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{
    domain: string;
    available: boolean;
    owner?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!name.trim()) return;
    setChecking(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/domain/sol-lookup?domain=${encodeURIComponent(name.trim().toLowerCase())}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Lookup failed");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs font-bold text-[#9945FF] mb-1">.molt.sol subdomains (SNS)</div>
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase());
              setResult(null);
              setError(null);
            }}
            placeholder="agentname"
            maxLength={32}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-l focus:border-[#9945FF] focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
        </div>
        <span className="inline-flex items-center px-2 py-1.5 text-sm font-bold text-[#9945FF] bg-[#f3e8ff] border border-l-0 border-gray-300 rounded-r">
          .molt.sol
        </span>
        <button
          onClick={lookup}
          disabled={checking || !name.trim()}
          className="px-3 py-1.5 text-sm font-bold text-white bg-[#9945FF] rounded hover:bg-[#7a35d4] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {checking ? "..." : "Check"}
        </button>
      </div>

      {result && (
        <div
          className={`p-2 rounded border text-xs ${
            result.available
              ? "bg-[#d9ffce] border-[#8fbc8f]"
              : "bg-[#ffebe8] border-[#dd3c10]"
          }`}
        >
          {result.available ? (
            <span className="font-bold text-green-700">✅ {result.domain} is available!</span>
          ) : (
            <div className="space-y-1">
              <span className="font-bold text-red-700">❌ {result.domain} is taken</span>
              {result.owner && (
                <div className="text-gray-600">
                  Owner:{" "}
                  <a
                    href={`https://solscan.io/account/${result.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#3b5998] hover:underline font-mono"
                  >
                    {result.owner.slice(0, 8)}...{result.owner.slice(-6)}
                  </a>
                  {" · "}
                  <a href={`/profile/${result.owner}`} className="text-[#ff6b35] hover:underline">
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

      <p className="text-[10px] text-gray-500">
        Powered by{" "}
        <a href="https://sns.id" target="_blank" rel="noopener noreferrer" className="text-[#9945FF] hover:underline">
          Solana Name Service ↗
        </a>
      </p>
    </div>
  );
}
