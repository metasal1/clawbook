"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import bs58 from "bs58";

export function SignMessage() {
  const { publicKey, signMessage } = useWallet();
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet does not support message signing");
      return;
    }

    try {
      setSigning(true);
      setError(null);
      setSignature(null);

      const message = `Welcome to Clawbook! 🦞\n\nSign this message to verify your wallet.\n\nWallet: ${publicKey.toBase58()}\nTimestamp: ${new Date().toISOString()}`;
      const encodedMessage = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signatureBytes);
      
      setSignature(signatureBase58);
    } catch (err: any) {
      setError(err.message || "Failed to sign message");
    } finally {
      setSigning(false);
    }
  };

  if (!publicKey) {
    return null;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs text-gray-600 mb-2">Verify your wallet ownership:</p>
      
      <button
        onClick={handleSign}
        disabled={signing}
        className="text-xs font-bold py-1 px-3 rounded"
        style={{
          background: signing ? "#ccc" : "linear-gradient(to bottom, #6d84b4, #5972a8)",
          border: "1px solid #29447e",
          color: "white",
          cursor: signing ? "wait" : "pointer",
        }}
      >
        {signing ? "Signing..." : signature ? "✓ Signed" : "Sign Message"}
      </button>

      {signature && (
        <div className="mt-2 p-2 bg-[#d9ffce] border border-[#8fbc8f] rounded text-[10px] break-all">
          <span className="font-bold text-green-700">✓ Verified!</span>
          <br />
          <span className="text-gray-600">Signature: {signature.slice(0, 20)}...{signature.slice(-20)}</span>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 bg-[#ffcccc] border border-[#cc0000] rounded text-[10px] text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

export default SignMessage;
