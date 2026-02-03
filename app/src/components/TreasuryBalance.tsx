"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const TREASURY = new PublicKey("5KHjC6FhyAGuJotSLvMn1mKqLLZjtz5CNRB3tzQadECP");

export function TreasuryBalance() {
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const lamports = await connection.getBalance(TREASURY);
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
  }, [connection]);

  return (
    <div className="text-xs">
      <p className="text-gray-600 mb-1">Squads Multisig:</p>
      <code className="text-[9px] break-all text-[#3b5998]">
        {TREASURY.toBase58()}
      </code>

      {/* Balance */}
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
          href={`https://explorer.solana.com/address/${TREASURY.toBase58()}?cluster=devnet`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b5998] hover:underline block"
        >
          » Explorer ↗
        </a>
        <a
          href={`https://v3.squads.so/squad/${TREASURY.toBase58()}?network=devnet`}
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
