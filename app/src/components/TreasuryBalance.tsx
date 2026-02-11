"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const MAINNET_VAULT = new PublicKey("EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8");
const MAINNET_MULTISIG = "FUtXoDxnQfwcPAAPYPPnj8rjRfF37kTXVLcV8Jdbin3X";
const BOT_WALLET = new PublicKey("CLW4tAWpH43nZDeuVuMJAtdLDX2Nj6zWPXGLjDR7vaYD");
const TOKEN_MINT = "Ard5TxtbtBf5gkdnRqb1SPVjyKZMHPAaG37EkE4xBAGS";
const TOKEN_DECIMALS = 9;

interface TokenHolding {
  wallet: string;
  label: string;
  amount: number;
}

export function TreasuryBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [tokenSymbol, setTokenSymbol] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mainnet = new Connection("https://viviyan-bkj12u-fast-mainnet.helius-rpc.com", "confirmed");

    async function fetchBalance() {
      try {
        const lamports = await mainnet.getBalance(MAINNET_VAULT);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error("Error fetching treasury balance:", e);
      } finally {
        setLoading(false);
      }
    }

    async function fetchTokenHoldings() {
      try {
        const mint = new PublicKey(TOKEN_MINT);
        const wallets = [
          { pubkey: MAINNET_VAULT, label: "Multisig Vault" },
          { pubkey: BOT_WALLET, label: "Bot Wallet" },
        ];

        const holdings: TokenHolding[] = [];
        for (const w of wallets) {
          try {
            const accounts = await mainnet.getParsedTokenAccountsByOwner(w.pubkey, { mint });
            for (const acc of accounts.value) {
              const info = acc.account.data.parsed.info;
              const amt = parseFloat(info.tokenAmount.uiAmountString || "0");
              if (amt > 0) {
                holdings.push({ wallet: w.pubkey.toBase58(), label: w.label, amount: amt });
              }
            }
          } catch { /* no token account */ }
        }
        setTokenHoldings(holdings);

        // Fetch token metadata
        try {
          const resp = await fetch(`https://tokens.jup.ag/token/${TOKEN_MINT}`);
          if (resp.ok) {
            const data = await resp.json();
            setTokenSymbol(data.symbol || TOKEN_MINT.slice(0, 6));
          }
        } catch {
          setTokenSymbol(TOKEN_MINT.slice(0, 6));
        }
      } catch (e) {
        console.error("Error fetching token holdings:", e);
      }
    }

    fetchBalance();
    fetchTokenHoldings();
    const interval = setInterval(() => { fetchBalance(); fetchTokenHoldings(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalTokens = tokenHoldings.reduce((sum, h) => sum + h.amount, 0);

  return (
    <div className="text-xs">
      <p className="text-gray-600 mb-1 font-bold">Squads v4 Multisig (Mainnet)</p>
      <code className="text-[9px] break-all text-[#3b5998]">
        {MAINNET_VAULT.toBase58()}
      </code>

      <div className="mt-2 bg-[#f0f4ff] border border-[#3b5998] rounded p-2 text-center">
        {loading ? (
          <div className="animate-pulse text-gray-400">...</div>
        ) : (
          <>
            <div className="text-lg font-bold text-[#3b5998]">
              {balance !== null ? balance.toFixed(4) : "—"}
            </div>
            <div className="text-[10px] text-gray-500">SOL</div>
          </>
        )}
      </div>

      {/* Token Holdings */}
      {tokenHoldings.length > 0 && (
        <div className="mt-2 bg-[#fff8f0] border border-[#ff6b35] rounded p-2">
          <p className="text-[10px] font-bold text-[#ff6b35] mb-1">Token Holdings</p>
          {tokenHoldings.map((h, i) => (
            <div key={i} className="flex justify-between items-center text-[10px] py-0.5">
              <span className="text-gray-600">{h.label}</span>
              <span className="font-mono font-bold text-[#3b5998]">
                {h.amount >= 1_000_000 ? `${(h.amount / 1_000_000).toFixed(2)}M` : h.amount.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="border-t border-[#ff6b35]/30 mt-1 pt-1 flex justify-between items-center text-[10px]">
            <span className="font-bold text-gray-700">Total</span>
            <span className="font-mono font-bold text-[#ff6b35]">
              {totalTokens >= 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(2)}M` : totalTokens.toLocaleString()}
              {tokenSymbol && ` ${tokenSymbol}`}
            </span>
          </div>
          <a
            href={`https://solscan.io/token/${TOKEN_MINT}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#ff6b35] hover:underline block mt-1 text-[9px]"
          >
            » View Token ↗
          </a>
        </div>
      )}

      <div className="mt-2 space-y-1">
        <a
          href={`https://explorer.solana.com/address/${MAINNET_VAULT.toBase58()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b5998] hover:underline block"
        >
          » Explorer ↗
        </a>
        <a
          href={`https://app.squads.so/squads/${MAINNET_VAULT.toBase58()}/home`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b5998] hover:underline block"
        >
          » Squads ↗
        </a>
      </div>
    </div>
  );
}
