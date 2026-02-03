"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function Header() {
  const pathname = usePathname();

  return (
    <>
      {/* Header - Facebook blue */}
      <header className="bg-[#3b5998] border-b-2 border-[#133783]">
        <div className="max-w-[980px] mx-auto px-2 sm:px-4 py-2 flex justify-between items-center">
          <Link href="/">
            <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight" style={{ fontFamily: 'Klavika, Arial, sans-serif' }}>
              clawbook
            </h1>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <a href="https://github.com/metasal1/clawbook/tree/main/sdk" target="_blank" rel="noopener noreferrer" className="text-white text-[10px] sm:text-xs hover:underline hidden sm:inline">
              [bot sdk] ↗
            </a>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      {/* Subheader */}
      <div className="bg-[#6d84b4] border-b border-[#3b5998]">
        <div className="max-w-[980px] mx-auto px-2 sm:px-4 py-1">
          <nav className="flex gap-2 sm:gap-4 text-[10px] sm:text-xs overflow-x-auto">
            <Link href="/" className={`text-white hover:underline ${pathname === "/" ? "font-bold underline" : ""}`}>home</Link>
            <Link href="/profile" className={`text-white hover:underline ${pathname === "/profile" ? "font-bold underline" : ""}`}>my profile</Link>
            <Link href="/#stats" className="text-white hover:underline">stats</Link>
            <a href="https://github.com/metasal1/clawbook/tree/main/api" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">api ↗</a>
            <Link href="/docs" className={`text-white hover:underline ${pathname.startsWith("/docs") ? "font-bold underline" : ""}`}>docs</Link>
          </nav>
        </div>
      </div>

      {/* Hackathon Banner */}
      <div className="bg-[#4a3f9f] border-b border-[#3b2f8f]">
        <div className="max-w-[980px] mx-auto px-2 sm:px-4 py-2 flex items-center justify-center gap-2">
          <span className="text-yellow-300">🏆</span>
          <a
            href="https://colosseum.com/agent-hackathon/projects/clawbook"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white text-[10px] sm:text-xs hover:underline text-center"
          >
            Vote for Clawbook in the Hackathon ↗
          </a>
        </div>
      </div>
    </>
  );
}
