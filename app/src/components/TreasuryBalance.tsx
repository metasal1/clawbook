"use client";

import { useEffect, useState } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const MAINNET_VAULT = new PublicKey("EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8");
const MAINNET_MULTISIG = "FUtXoDxnQfwcPAAPYPPnj8rjRfF37kTXVLcV8Jdbin3X";

export function TreasuryBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const mainnet = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
        const lamports = await mainnet.getBalance(MAINNET_VAULT);
        setBalance(lamports / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error("Error fetching treasury balance:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

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
