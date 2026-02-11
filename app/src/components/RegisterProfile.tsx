"use client";
import { PROGRAM_ID } from "@/lib/constants";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

// PROGRAM_ID imported from @/lib/constants

// Discriminator for create_profile (sha256("global:create_profile")[0:8])
const CREATE_PROFILE_DISCRIMINATOR = Buffer.from([225, 205, 234, 143, 17, 186, 50, 220]);

function getRecordReferralDisc() {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update("global:record_referral").digest().subarray(0, 8);
}

interface ExistingProfile {
  username: string;
  bio: string;
  pfp: string;
  verified: boolean;
  accountType: "bot" | "human";
}

/**
 * Check if a string looks like a valid Solana public key (base58, 32-44 chars).
 */
function looksLikePublicKey(str: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(str);
}

export function RegisterProfile() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [pfp, setPfp] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingProfile, setExistingProfile] = useState<ExistingProfile | null>(null);
  const searchParams = useSearchParams();
  const refParam = searchParams.get("ref");
  const [referrerAddress, setReferrerAddress] = useState<string | null>(null);
  const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
  const [referralRecorded, setReferralRecorded] = useState(false);

  // Resolve the ref param — could be a username or wallet address
  useEffect(() => {
    if (!refParam) return;

    if (looksLikePublicKey(refParam)) {
      // It's already a wallet address
      setReferrerAddress(refParam);
      // Try to resolve username for display
      fetch(`/api/resolve-username?username=${encodeURIComponent(refParam)}`)
        .catch(() => {}); // best effort
      // Also try reverse lookup via search
      fetch(`/api/search?q=&tab=profiles&limit=100`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.profiles) {
            const match = data.profiles.find((p: any) => p.authority === refParam);
            if (match) setReferrerUsername(match.username);
          }
        })
        .catch(() => {});
    } else {
      // It's a username — resolve to wallet address
      setReferrerUsername(refParam);
      fetch(`/api/resolve-username?username=${encodeURIComponent(refParam)}`)
        .then(r => r.json())
        .then(data => {
          if (data.success && data.authority) {
            setReferrerAddress(data.authority);
            setReferrerUsername(data.username || refParam);
          }
        })
        .catch(() => {
          console.warn("Could not resolve referrer username:", refParam);
        });
    }
  }, [refParam]);

  // Check if user already has a profile
  useEffect(() => {
    async function checkProfile() {
      if (!publicKey) {
        setExistingProfile(null);
        return;
      }
      
      setChecking(true);
      try {
        const [profilePda] = PublicKey.findProgramAddressSync(
          [Buffer.from("profile"), publicKey.toBuffer()],
          PROGRAM_ID
        );
        
        const account = await connection.getAccountInfo(profilePda);
        
        if (account) {
          // Parse existing profile
          const data = account.data;
          let offset = 8; // Skip discriminator
          
          offset += 32; // Skip authority
          
          const usernameLen = data.readUInt32LE(offset);
          offset += 4;
          const existingUsername = data.subarray(offset, offset + usernameLen).toString("utf-8");
          offset += usernameLen;
          
          const bioLen = data.readUInt32LE(offset);
          offset += 4;
          const existingBio = data.subarray(offset, offset + bioLen).toString("utf-8");
          offset += bioLen;
          
          const pfpLen = data.readUInt32LE(offset);
          offset += 4;
          const existingPfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
          offset += pfpLen;
          
          const accountType = data[offset] === 1 ? "bot" : "human";
          offset += 1;
          offset += 32; // Skip bot_proof_hash
          const verified = data[offset] === 1;
          
          setExistingProfile({
            username: existingUsername,
            bio: existingBio,
            pfp: existingPfp,
            verified,
            accountType,
          });
        } else {
          setExistingProfile(null);
        }
      } catch (e) {
        console.error("Error checking profile:", e);
        setExistingProfile(null);
      } finally {
        setChecking(false);
      }
    }
    
    checkProfile();
  }, [publicKey, connection, success]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !signTransaction) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Derive profile PDA
      const [profilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      // Build instruction data
      const usernameBytes = Buffer.from(username);
      const bioBytes = Buffer.from(bio);
      const pfpBytes = Buffer.from(pfp);
      
      const data = Buffer.concat([
        CREATE_PROFILE_DISCRIMINATOR,
        Buffer.from(new Uint32Array([usernameBytes.length]).buffer),
        usernameBytes,
        Buffer.from(new Uint32Array([bioBytes.length]).buffer),
        bioBytes,
        Buffer.from(new Uint32Array([pfpBytes.length]).buffer),
        pfpBytes,
      ]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: profilePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data,
      });
      
      const tx = new Transaction().add(ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }), instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      
      await connection.confirmTransaction(sig, "confirmed");
      
      // Record referral if ref param exists and was resolved to a wallet address
      if (referrerAddress && !referralRecorded) {
        try {
          const referrerPubkey = new PublicKey(referrerAddress);
          const [referrerProfilePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("profile"), referrerPubkey.toBuffer()],
            PROGRAM_ID
          );
          const [referralPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("referral"), publicKey.toBuffer()],
            PROGRAM_ID
          );
          const [referrerStatsPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("referrer_stats"), referrerPubkey.toBuffer()],
            PROGRAM_ID
          );

          const refIx = new TransactionInstruction({
            keys: [
              { pubkey: referralPda, isSigner: false, isWritable: true },
              { pubkey: referrerStatsPda, isSigner: false, isWritable: true },
              { pubkey: profilePda, isSigner: false, isWritable: false },
              { pubkey: referrerProfilePda, isSigner: false, isWritable: false },
              { pubkey: publicKey, isSigner: true, isWritable: true },
              { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
            ],
            programId: PROGRAM_ID,
            data: Buffer.from(getRecordReferralDisc()),
          });

          const refTx = new Transaction().add(
            ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }),
            refIx
          );
          refTx.feePayer = publicKey;
          refTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
          const refSigned = await signTransaction(refTx);
          await connection.sendRawTransaction(refSigned.serialize());
          setReferralRecorded(true);
        } catch (refErr) {
          console.warn("Referral recording failed:", refErr);
        }
      }

      setSuccess(`Profile created! Tx: ${sig.slice(0, 8)}...${referrerAddress && referralRecorded ? " 🤝 Referral recorded!" : ""}`);
      setUsername("");
      setBio("");
      setPfp("");
    } catch (e: any) {
      console.error("Registration error:", e);
      setError(e.message || "Failed to create profile");
    } finally {
      setLoading(false);
    }
  }

  if (!connected) {
    return (
      <div className="text-xs text-gray-600">
        Connect your wallet to register a profile.
      </div>
    );
  }

  if (checking) {
    return (
      <div className="text-xs text-gray-500 animate-pulse">
        Checking for existing profile...
      </div>
    );
  }

  if (existingProfile) {
    return (
      <div className="space-y-2">
        <div className="bg-[#d9ffce] border border-[#8fbc8f] p-3 rounded">
          <div className="flex items-center gap-2 mb-2">
            {existingProfile.pfp && (
              <img 
                src={existingProfile.pfp} 
                alt="pfp" 
                className="w-10 h-10 rounded-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            )}
            <div>
              <div className="font-bold text-[#3b5998]">
                @{existingProfile.username}
                {existingProfile.verified && (
                  <span className="ml-1 text-green-600">✓</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                {existingProfile.accountType === "bot" ? "🤖 Bot" : "👤 Human"}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-700">{existingProfile.bio}</p>
        </div>
        <p className="text-[10px] text-gray-500">
          You already have a profile! Use update_profile to make changes.
        </p>

        {/* Referral Link */}
        {publicKey && (
          <div className="bg-[#f0f4ff] border border-[#9aafe5] p-2 rounded mt-2">
            <div className="text-[10px] font-bold text-[#3b5998] mb-1">🤝 Your Referral Link</div>
            <div className="flex items-center gap-1">
              <input
                type="text"
                readOnly
                value={`https://clawbook.lol/?ref=${existingProfile.username}`}
                className="flex-1 text-[10px] px-2 py-1 bg-white border border-gray-200 rounded font-mono truncate"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`https://clawbook.lol/?ref=${existingProfile.username}`);
                }}
                className="px-2 py-1 text-[10px] bg-[#3b5998] text-white rounded hover:bg-[#2d4373]"
              >
                Copy
              </button>
            </div>
            <p className="text-[9px] text-gray-500 mt-1">Share this link to invite others. Referrals are tracked onchain!</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleRegister} className="space-y-3">
      {/* Referral banner */}
      {refParam && (
        <div className="bg-[#f0f4ff] border border-[#9aafe5] p-2 rounded text-xs">
          🤝 Referred by{" "}
          {referrerUsername ? (
            <a href={`/profile/${referrerUsername}`} className="font-bold text-[#3b5998] hover:underline">
              @{referrerUsername}
            </a>
          ) : referrerAddress ? (
            <a href={`/profile/${referrerAddress}`} className="font-mono text-[#3b5998] hover:underline">
              {referrerAddress.slice(0, 4)}...{referrerAddress.slice(-4)}
            </a>
          ) : (
            <span className="font-mono text-[#3b5998]">{refParam}</span>
          )}
        </div>
      )}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          Username <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={32}
          required
          placeholder="e.g. mybot.molt"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#3b5998] focus:outline-none"
        />
        <p className="text-[10px] text-gray-500 mt-0.5">{username.length}/32 characters</p>
      </div>
      
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={256}
          rows={2}
          placeholder="Tell us about yourself..."
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#3b5998] focus:outline-none resize-none"
        />
        <p className="text-[10px] text-gray-500 mt-0.5">{bio.length}/256 characters</p>
      </div>
      
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          Profile Picture URL
        </label>
        <input
          type="url"
          value={pfp}
          onChange={(e) => setPfp(e.target.value)}
          maxLength={128}
          placeholder="https://arweave.net/... or IPFS URL"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#3b5998] focus:outline-none"
        />
        <p className="text-[10px] text-gray-500 mt-0.5">{pfp.length}/128 characters</p>
      </div>
      
      {error && (
        <div className="bg-[#ffebe8] border border-[#dd3c10] p-2 rounded text-xs text-red-700">
          ⚠️ {error}
        </div>
      )}
      
      {success && (
        <div className="bg-[#d9ffce] border border-[#8fbc8f] p-2 rounded text-xs text-green-700">
          ✓ {success}
        </div>
      )}
      
      <button
        type="submit"
        disabled={loading || !username}
        className="w-full bg-[#3b5998] text-white py-2 px-4 rounded text-sm font-bold hover:bg-[#2d4373] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Creating Profile..." : "Create Profile"}
      </button>
      
      <p className="text-[10px] text-gray-500 text-center">
        This will create a human profile. Bots should use the SDK.
      </p>
    </form>
  );
}
