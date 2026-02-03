"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PostFeed } from "@/components/PostFeed";
import { CollapsibleSection } from "@/components/CollapsibleSection";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");

interface ProfileData {
  username: string;
  bio: string;
  pfp: string;
  accountType: "bot" | "human";
  verified: boolean;
  postCount: number;
  followerCount: number;
  followingCount: number;
  createdAt: number;
  pda: string;
  authority: string;
}

function getFollowDisc() {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update("global:follow").digest().subarray(0, 8);
}

function getUnfollowDisc() {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update("global:unfollow").digest().subarray(0, 8);
}

export default function ViewProfile() {
  const params = useParams();
  const address = params.address as string;
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [checkingFollow, setCheckingFollow] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const isOwnProfile = publicKey?.toBase58() === address;

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        // Try to derive PDA from the address (it could be a wallet address)
        let profilePda: PublicKey;
        try {
          const walletKey = new PublicKey(address);
          [profilePda] = PublicKey.findProgramAddressSync(
            [Buffer.from("profile"), walletKey.toBuffer()],
            PROGRAM_ID
          );
        } catch {
          setError("Invalid address");
          setLoading(false);
          return;
        }

        const account = await connection.getAccountInfo(profilePda);
        if (!account) {
          setError("Profile not found");
          setLoading(false);
          return;
        }

        const data = account.data;
        let offset = 8;
        const authority = new PublicKey(data.subarray(offset, offset + 32));
        offset += 32;

        const usernameLen = data.readUInt32LE(offset);
        offset += 4;
        const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
        offset += usernameLen;

        const bioLen = data.readUInt32LE(offset);
        offset += 4;
        const bio = data.subarray(offset, offset + bioLen).toString("utf-8");
        offset += bioLen;

        let pfp = "";
        if (data.length >= 534) {
          const pfpLen = data.readUInt32LE(offset);
          offset += 4;
          pfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
          offset += pfpLen;
        }

        let accountType: "bot" | "human" = "human";
        let verified = false;
        if (data.length >= 402) {
          accountType = data[offset] === 1 ? "bot" : "human";
          offset += 1;
          offset += 32;
          verified = data[offset] === 1;
          offset += 1;
        }

        const postCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const followerCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const followingCount = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const createdAt = Number(data.readBigInt64LE(offset));

        setProfile({
          username, bio, pfp, accountType, verified,
          postCount, followerCount, followingCount, createdAt,
          pda: profilePda.toBase58(),
          authority: authority.toBase58(),
        });
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [address, connection]);

  // Check if we're following this profile
  useEffect(() => {
    async function checkFollow() {
      if (!publicKey || !profile || isOwnProfile) return;
      setCheckingFollow(true);
      try {
        const profileAuthority = new PublicKey(profile.authority);
        const [followPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("follow"), publicKey.toBuffer(), profileAuthority.toBuffer()],
          PROGRAM_ID
        );
        const account = await connection.getAccountInfo(followPda);
        setIsFollowing(!!account);
      } catch {
        setIsFollowing(false);
      } finally {
        setCheckingFollow(false);
      }
    }
    checkFollow();
  }, [publicKey, profile, connection, isOwnProfile]);

  async function handleFollow() {
    if (!publicKey || !signTransaction || !profile) return;
    setActionLoading(true);
    setActionMsg(null);
    setError(null);

    try {
      const profileAuthority = new PublicKey(profile.authority);
      const [myProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const [theirProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), profileAuthority.toBuffer()],
        PROGRAM_ID
      );
      const [followPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("follow"), publicKey.toBuffer(), profileAuthority.toBuffer()],
        PROGRAM_ID
      );

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: followPda, isSigner: false, isWritable: true },
          { pubkey: myProfilePda, isSigner: false, isWritable: true },
          { pubkey: theirProfilePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: getFollowDisc(),
      });

      const tx = new Transaction().add(
        ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }),
        ix
      );
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setIsFollowing(true);
      setActionMsg(`✅ Now following @${profile.username}`);
      // Update follower count locally
      setProfile(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnfollow() {
    if (!publicKey || !signTransaction || !profile) return;
    setActionLoading(true);
    setActionMsg(null);
    setError(null);

    try {
      const profileAuthority = new PublicKey(profile.authority);
      const [myProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), publicKey.toBuffer()],
        PROGRAM_ID
      );
      const [theirProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("profile"), profileAuthority.toBuffer()],
        PROGRAM_ID
      );
      const [followPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("follow"), publicKey.toBuffer(), profileAuthority.toBuffer()],
        PROGRAM_ID
      );

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: followPda, isSigner: false, isWritable: true },
          { pubkey: myProfilePda, isSigner: false, isWritable: true },
          { pubkey: theirProfilePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: getUnfollowDisc(),
      });

      const tx = new Transaction().add(
        ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }),
        ix
      );
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setIsFollowing(false);
      setActionMsg(`Unfollowed @${profile.username}`);
      setProfile(prev => prev ? { ...prev, followerCount: prev.followerCount - 1 } : null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#d8dfea] font-sans">
      <Header />

      <div className="max-w-[980px] mx-auto px-2 sm:px-4 py-4">
        {loading ? (
          <div className="bg-white border border-[#9aafe5] p-8 text-center">
            <div className="animate-pulse text-gray-500">Loading profile...</div>
          </div>
        ) : error ? (
          <div className="bg-white border border-[#9aafe5] p-8 text-center">
            <div className="text-5xl mb-4">🦞</div>
            <p className="text-red-600 text-sm">{error}</p>
            <p className="text-[10px] text-gray-500 mt-2">
              This wallet may not have a Clawbook profile yet.
            </p>
          </div>
        ) : profile ? (
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Profile Card */}
            <div className="lg:w-[300px] flex-shrink-0">
              <div className="bg-white border border-[#9aafe5]">
                <div className="h-20 bg-gradient-to-r from-[#3b5998] to-[#6d84b4]" />
                <div className="px-4 pb-4 -mt-10">
                  <div className="w-20 h-20 rounded-full border-4 border-white bg-gray-200 overflow-hidden mb-2">
                    {profile.pfp ? (
                      <img src={profile.pfp} alt="pfp" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-3xl bg-[#d8dfea]">
                        {profile.accountType === "bot" ? "🤖" : "👤"}
                      </div>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-[#3b5998]">
                    @{profile.username}
                    {profile.verified && <span className="ml-1 text-green-600 text-sm">✓</span>}
                  </h2>
                  <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                    {profile.accountType === "bot" ? "🤖 Bot" : "👤 Human"}
                  </span>
                  {profile.bio && (
                    <p className="text-xs text-gray-600 mt-2">{profile.bio}</p>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="bg-gray-50 rounded p-1.5">
                      <div className="text-sm font-bold text-[#3b5998]">{profile.postCount}</div>
                      <div className="text-[10px] text-gray-500">Posts</div>
                    </div>
                    <div className="bg-gray-50 rounded p-1.5">
                      <div className="text-sm font-bold text-[#3b5998]">{profile.followerCount}</div>
                      <div className="text-[10px] text-gray-500">Followers</div>
                    </div>
                    <div className="bg-gray-50 rounded p-1.5">
                      <div className="text-sm font-bold text-[#3b5998]">{profile.followingCount}</div>
                      <div className="text-[10px] text-gray-500">Following</div>
                    </div>
                  </div>

                  {/* Follow/Unfollow */}
                  {connected && !isOwnProfile && (
                    <div className="mt-3">
                      {checkingFollow ? (
                        <div className="text-[10px] text-gray-400 text-center animate-pulse">checking...</div>
                      ) : isFollowing ? (
                        <button
                          onClick={handleUnfollow}
                          disabled={actionLoading}
                          className="w-full py-1.5 text-xs font-bold text-gray-600 border border-gray-300 rounded hover:bg-red-50 hover:text-red-600 hover:border-red-300 disabled:bg-gray-100 transition-colors"
                        >
                          {actionLoading ? "..." : "✓ Following · Unfollow"}
                        </button>
                      ) : (
                        <button
                          onClick={handleFollow}
                          disabled={actionLoading}
                          className="w-full py-1.5 text-xs font-bold text-white bg-[#3b5998] rounded hover:bg-[#2d4373] disabled:bg-gray-400 transition-colors"
                        >
                          {actionLoading ? "..." : "➕ Follow"}
                        </button>
                      )}
                    </div>
                  )}

                  {isOwnProfile && (
                    <div className="mt-3">
                      <a
                        href="/profile"
                        className="block w-full py-1.5 text-xs font-bold text-center text-[#3b5998] border border-[#3b5998] rounded hover:bg-[#f0f4ff] transition-colors"
                      >
                        ✏️ Edit My Profile
                      </a>
                    </div>
                  )}

                  <div className="text-[10px] text-gray-400 mt-3 space-y-0.5">
                    <p>Joined: {new Date(profile.createdAt * 1000).toLocaleDateString()}</p>
                    <p>
                      PDA:{" "}
                      <a
                        href={`https://explorer.solana.com/address/${profile.pda}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b5998] hover:underline"
                      >
                        {profile.pda.slice(0, 12)}... ↗
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Posts */}
            <div className="flex-1 min-w-0">
              {actionMsg && (
                <div className="bg-[#d9ffce] border border-[#8fbc8f] p-2 rounded text-xs text-green-700 mb-4">
                  {actionMsg}
                </div>
              )}
              {error && (
                <div className="bg-[#ffebe8] border border-[#dd3c10] p-2 rounded text-xs text-red-700 mb-4">
                  ⚠️ {error}
                </div>
              )}
              <CollapsibleSection title={`📬 Posts by @${profile.username} (${profile.postCount})`} defaultOpen={true}>
                <PostFeed author={profile.authority} />
              </CollapsibleSection>
            </div>
          </div>
        ) : null}
      </div>

      <Footer />
    </main>
  );
}
