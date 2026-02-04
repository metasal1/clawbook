"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const DEVNET_TREASURY = new PublicKey("5KHjC6FhyAGuJotSLvMn1mKqLLZjtz5CNRB3tzQadECP");
const MAINNET_VAULT = new PublicKey("8iLn3JJRujBUtes3FdV9ethaLDjhcjZSWNRadKmWTtBP");
const MAINNET_MULTISIG = "7Bv2GatUU4TXQjQVp6WgqYwKwUvETvpVgeT19M1jTR4p";

export function TreasuryBalance() {
  const { connection } = useConnection();
  const [devnetBalance, setDevnetBalance] = useState<number | null>(null);
  const [mainnetBalance, setMainnetBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalances() {
      try {
        // Devnet balance (from wallet adapter connection)
        const devLamports = await connection.getBalance(DEVNET_TREASURY);
        setDevnetBalance(devLamports / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error("Error fetching devnet treasury:", e);
      }

      try {
        // Mainnet balance (separate connection)
        const mainnet = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
        const mainLamports = await mainnet.getBalance(MAINNET_VAULT);
        setMainnetBalance(mainLamports / LAMPORTS_PER_SOL);
      } catch (e) {
        console.error("Error fetching mainnet treasury:", e);
      }

      setLoading(false);
    }

    fetchBalances();
    const interval = setInterval(fetchBalances, 30000);
    return () => clearInterval(interval);
  }, [connection]);

  return (
    <div className="text-xs space-y-3">
      {/* Mainnet Treasury */}
      <div>
        <p className="text-gray-600 mb-1 font-bold">🟢 Mainnet Treasury</p>
        <code className="text-[9px] break-all text-[#3b5998]">
          {MAINNET_VAULT.toBase58()}
        </code>
        <div className="mt-1 bg-[#f0f4ff] border border-[#3b5998] rounded p-2 text-center">
          {loading ? (
            <div className="animate-pulse text-gray-400">...</div>
          ) : (
            <>
              <div className="text-lg font-bold text-[#3b5998]">
                {mainnetBalance !== null ? mainnetBalance.toFixed(4) : "—"}
              </div>
              <div className="text-[10px] text-gray-500">SOL (mainnet)</div>
            </>
          )}
        </div>
        <div className="mt-1 space-y-0.5">
          <a
            href={`https://explorer.solana.com/address/${MAINNET_VAULT.toBase58()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b5998] hover:underline block text-[10px]"
          >
            » Explorer ↗
          </a>
          <a
            href={`https://v4.squads.so/squads/${MAINNET_MULTISIG}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b5998] hover:underline block text-[10px]"
          >
            » Squads v4 ↗
          </a>
        </div>
      </div>

      {/* Devnet Treasury */}
      <div>
        <p className="text-gray-600 mb-1 font-bold">🟣 Devnet Treasury</p>
        <code className="text-[9px] break-all text-[#3b5998]">
          {DEVNET_TREASURY.toBase58()}
        </code>
        <div className="mt-1 bg-gray-50 border border-gray-300 rounded p-2 text-center">
          {loading ? (
            <div className="animate-pulse text-gray-400">...</div>
          ) : (
            <>
              <div className="text-base font-bold text-gray-600">
                {devnetBalance !== null ? devnetBalance.toFixed(4) : "—"}
              </div>
              <div className="text-[10px] text-gray-500">SOL (devnet)</div>
            </>
          )}
        </div>
        <div className="mt-1 space-y-0.5">
          <a
            href={`https://explorer.solana.com/address/${DEVNET_TREASURY.toBase58()}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b5998] hover:underline block text-[10px]"
          >
            » Explorer ↗
          </a>
          <a
            href={`https://v3.squads.so/squad/${DEVNET_TREASURY.toBase58()}?network=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#3b5998] hover:underline block text-[10px]"
          >
            » Squads v3 ↗
          </a>
        </div>
      </div>
    </div>
  );
}
