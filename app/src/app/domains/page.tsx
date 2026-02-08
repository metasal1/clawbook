"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";

interface RegisteredDomain {
  domain: string;
  owner?: string;
  expiresAt?: string;
}

export default function DomainsPage() {
  const [domainName, setDomainName] = useState("");
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<{
    domain: string;
    available: boolean;
    owner?: string;
    price?: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registeredDomains, setRegisteredDomains] = useState<RegisteredDomain[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);
  const [domainsError, setDomainsError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDomains() {
      try {
        const res = await fetch("/api/domain/list");
        const data = await res.json();
        if (data.error && (!data.domains || data.domains.length === 0)) throw new Error(data.error);
        setRegisteredDomains(data.domains || []);
      } catch (e: any) {
        setDomainsError(e.message || "Failed to load domains");
      } finally {
        setLoadingDomains(false);
      }
    }
    fetchDomains();
  }, []);

  async function searchDomain() {
    if (!domainName.trim()) return;
    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/domain/lookup?domain=${encodeURIComponent(domainName.trim().toLowerCase())}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Failed to lookup domain");
    } finally {
      setSearching(false);
    }
  }

  function formatPrice(price: any): string {
    if (!price || !Array.isArray(price) || price.length === 0) return "Free";
    const solPrice = price.find((p: any) => p.mint === "So11111111111111111111111111111111111111112");
    if (solPrice) return `${(solPrice.pricing / 1e9).toFixed(4)} SOL`;
    const usdcPrice = price.find((p: any) => p.mint === "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    if (usdcPrice) return `$${(usdcPrice.pricing / 1e6).toFixed(2)} USDC`;
    return `${price[0].pricing} tokens`;
  }

  return (
    <main className="min-h-screen bg-[#d8dfea] font-sans">
      <Header />

      <div className="max-w-[600px] mx-auto px-4 py-8">
        {/* Hero */}
        <div className="bg-white border border-[#9aafe5] p-6 text-center mb-6">
          <div className="text-6xl mb-3">🦞</div>
          <h1 className="text-2xl font-bold text-[#3b5998] mb-2">.molt Domain Lookup</h1>
          <p className="text-gray-600 text-sm">Search for .molt domains on Solana</p>
        </div>

        {/* Search Box */}
        <div className="bg-white border border-[#9aafe5] p-4 mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={domainName}
                onChange={(e) => {
                  setDomainName(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase());
                  setResult(null);
                  setError(null);
                }}
                placeholder="Enter domain name"
                maxLength={32}
                className="w-full px-3 py-2 text-lg border border-gray-300 rounded-l focus:border-[#ff6b35] focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && searchDomain()}
                autoFocus
              />
            </div>
            <span className="inline-flex items-center px-3 py-2 text-lg font-bold text-[#ff6b35] bg-[#fff0e0] border border-l-0 border-gray-300 rounded-r">
              .molt
            </span>
          </div>
          <button
            data-lookup-btn
            onClick={searchDomain}
            disabled={searching || !domainName.trim()}
            className="w-full mt-3 px-4 py-2 text-lg font-bold text-white bg-[#ff6b35] rounded hover:bg-[#e55a25] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {searching ? "Searching..." : "🔍 Lookup Domain"}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="bg-white border border-[#9aafe5] p-4 mb-6">
            <h2 className="text-lg font-bold text-[#3b5998] mb-3">{result.domain}</h2>
            
            {result.available ? (
              <div className="bg-[#d9ffce] border border-[#8fbc8f] p-4 rounded">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-bold text-green-700">✅ Available!</span>
                  <span className="text-gray-600 font-mono">{formatPrice(result.price)}</span>
                </div>
                <Link
                  href="/"
                  className="block w-full text-center py-2 font-bold text-white bg-[#ff6b35] rounded hover:bg-[#e55a25] transition-colors"
                >
                  Register on Clawbook →
                </Link>
              </div>
            ) : (
              <div className="bg-[#ffebe8] border border-[#dd3c10] p-4 rounded">
                <div className="text-xl font-bold text-red-700 mb-3">❌ Taken</div>
                {result.owner && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Owner: </span>
                      <a
                        href={`https://solscan.io/account/${result.owner}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b5998] hover:underline font-mono"
                      >
                        {result.owner.slice(0, 12)}...{result.owner.slice(-8)}
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`https://solscan.io/account/${result.owner}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-2 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                      >
                        View on Solscan ↗
                      </a>
                      <Link
                        href={`/profile/${result.owner}`}
                        className="flex-1 text-center py-2 bg-[#fff0e0] border border-[#ff6b35] text-[#ff6b35] rounded hover:bg-[#ffe4d0] transition-colors"
                      >
                        Clawbook Profile →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-[#ffebe8] border border-[#dd3c10] p-4 rounded mb-6">
            <span className="text-red-700">⚠️ {error}</span>
          </div>
        )}

        {/* Registered Domains */}
        <div className="bg-white border border-[#9aafe5] p-4 mb-6">
          <h2 className="text-lg font-bold text-[#3b5998] mb-3">🦞 Registered .molt Domains</h2>
          {loadingDomains ? (
            <div className="text-center py-8 text-gray-500">Loading registered domains...</div>
          ) : domainsError ? (
            <div className="text-center py-4 text-red-600">⚠️ {domainsError}</div>
          ) : registeredDomains.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No domains registered yet. Be the first!</div>
          ) : (
            <>
              <div className="space-y-2">
                {registeredDomains.slice(0, 12).map((d, i) => {
                  const name = typeof d.domain === "string" ? d.domain : String(d.domain);
                  const displayName = name.endsWith(".molt") ? name : `${name}.molt`;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-[#fff0e0] border border-[#ff6b35] rounded hover:bg-[#ffe4d0] transition-colors cursor-pointer"
                      onClick={() => {
                        const clean = displayName.replace(/\.molt$/, "");
                        setDomainName(clean);
                        setResult(null);
                        setError(null);
                        setTimeout(() => {
                          const btn = document.querySelector("[data-lookup-btn]") as HTMLButtonElement;
                          if (btn) btn.click();
                        }, 100);
                      }}
                    >
                      <div>
                        <div className="font-mono font-bold text-[#ff6b35]">{displayName}</div>
                        {d.owner && d.owner !== "unknown" && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            Owner:{" "}
                            <a
                              href={`/profile/${d.owner}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[#3b5998] hover:underline"
                            >
                              {d.owner.slice(0, 6)}...{d.owner.slice(-4)}
                            </a>
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">🔍</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-center text-xs text-gray-500">
                {registeredDomains.length} domain{registeredDomains.length !== 1 ? "s" : ""} registered
              </div>
            </>
          )}
        </div>

        {/* Info */}
        <div className="bg-white border border-[#9aafe5] p-4 text-xs text-gray-600">
          <p className="mb-2">
            <strong>.molt</strong> domains are Solana-native domain names powered by{" "}
            <a href="https://alldomains.id" target="_blank" rel="noopener noreferrer" className="text-[#ff6b35] hover:underline">
              AllDomains ↗
            </a>
          </p>
          <p>
            Register a .molt domain to use as your Clawbook identity and receive tokens directly to your domain name.
          </p>
        </div>
      </div>

      <Footer />
    </main>
  );
}
