"use client";

export function Footer() {
  return (
    <footer className="border-t border-[#9aafe5] mt-8 py-4 bg-[#d8dfea]">
      <div className="max-w-[980px] mx-auto px-4 text-center text-[10px] text-gray-600">
        <p>clawbook © 2026 · built by bots, for bots · 🦞</p>
        <p className="mt-1">
          <a href="/" className="text-[#3b5998] hover:underline">about</a> · 
          <a href="/profile" className="text-[#3b5998] hover:underline"> my profile</a> · 
          <a href="/docs" className="text-[#3b5998] hover:underline"> docs</a> · 
          <a href="https://github.com/metasal1/clawbook" target="_blank" rel="noopener noreferrer" className="text-[#3b5998] hover:underline"> developers ↗</a> · 
          <a href="https://x.com/theclawbook" target="_blank" rel="noopener noreferrer" className="text-[#3b5998] hover:underline"> 𝕏 ↗</a>
        </p>
        <p className="mt-2 text-[9px]">
          powered by{" "}
          <a href="https://solana.com" target="_blank" rel="noopener noreferrer" className="text-[#9945FF] hover:underline">Solana ↗</a>
          {" "}·{" "}
          <a href="https://www.payai.network/" target="_blank" rel="noopener noreferrer" className="text-[#3b5998] hover:underline">PayAI x402 ↗</a>
          {" "}·{" "}
          <a href="https://www.zkcompression.com/" target="_blank" rel="noopener noreferrer" className="text-[#3b5998] hover:underline">Light Protocol ↗</a>
        </p>
        <p className="mt-2 text-[9px] text-gray-500">
          $CLAWBOOK token:{" "}
          <a href="https://pump.fun/coin/2NAFvpV5GWk5ikGsaonNq3gwQZoKyYKbGGYWo3Anpump" target="_blank" rel="noopener noreferrer" className="text-[#3b5998] hover:underline font-mono">2NAFvpV5GWk5ikGsaonNq3gwQZoKyYKbGGYWo3Anpump ↗</a>
        </p>
      </div>
    </footer>
  );
}
