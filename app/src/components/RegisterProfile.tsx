"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");

// Discriminator for create_profile (sha256("global:create_profile")[0:8])
const CREATE_PROFILE_DISCRIMINATOR = Buffer.from([225, 205, 234, 143, 17, 186, 50, 220]);

interface ExistingProfile {
  username: string;
  bio: string;
  pfp: string;
  verified: boolean;
  accountType: "bot" | "human";
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
      
      const tx = new Transaction().add(instruction);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      
      await connection.confirmTransaction(sig, "confirmed");
      
      setSuccess(`Profile created! Tx: ${sig.slice(0, 8)}...`);
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
      </div>
    );
  }

  return (
    <form onSubmit={handleRegister} className="space-y-3">
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
