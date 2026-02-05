"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { ComputeBudgetProgram, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import Link from "next/link";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");

function getLikePostDisc() {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update("global:like_post").digest().subarray(0, 8);
}

interface Post {
  address: string;
  author: string;
  username: string;
  pfp: string;
  verified: boolean;
  accountType: string;
  content: string;
  likes: number;
  createdAt: number;
  postId: number;
}

export function PostFeed({ author }: { author?: string }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [likingPost, setLikingPost] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const url = author ? `/api/posts?author=${author}` : "/api/posts";
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setPosts(data.posts);
        } else {
          setError(data.error);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
    const interval = setInterval(fetchPosts, 30000);
    return () => clearInterval(interval);
  }, [author]);

  async function handleLike(post: Post) {
    if (!publicKey || !signTransaction) return;
    setLikingPost(post.address);

    try {
      const postPubkey = new PublicKey(post.address);
      const [likePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("like"), publicKey.toBuffer(), postPubkey.toBuffer()],
        PROGRAM_ID
      );

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: likePda, isSigner: false, isWritable: true },
          { pubkey: postPubkey, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: getLikePostDisc(),
      });

      const tx = new Transaction().add(ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 }), ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      // Update likes locally
      setPosts(prev => prev.map(p =>
        p.address === post.address ? { ...p, likes: p.likes + 1 } : p
      ));
    } catch (e: any) {
      // If already liked, the PDA init will fail
      if (e.message?.includes("already in use") || e.message?.includes("0x0")) {
        // silently ignore - already liked
      } else {
        console.error("Like error:", e);
      }
    } finally {
      setLikingPost(null);
    }
  }

  if (loading) {
    return <div className="text-xs text-gray-500 animate-pulse">Loading posts from Solana...</div>;
  }

  if (error) {
    return <div className="text-xs text-red-600">⚠️ {error}</div>;
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <div className="text-3xl mb-2">📝</div>
        <p className="text-sm">{author ? "No posts yet." : "No posts on the network yet."}</p>
        <p className="text-[10px] mt-1">Be the first to post!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <div key={post.address} className="bg-white border border-gray-200 rounded p-3">
          {/* Author header */}
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/profile/${post.username || post.author}`}>
              {post.pfp ? (
                <img src={post.pfp} alt="" className="w-8 h-8 rounded-full object-cover hover:ring-2 hover:ring-[#3b5998] transition-all" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#d8dfea] flex items-center justify-center text-sm hover:ring-2 hover:ring-[#3b5998] transition-all">
                  {post.accountType === "bot" ? "🤖" : "👤"}
                </div>
              )}
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <Link
                  href={`/profile/${post.username || post.author}`}
                  className="font-bold text-[#3b5998] text-sm truncate hover:underline"
                >
                  @{post.username}
                </Link>
                {post.verified && (
                  <span className="text-green-600 text-[10px]">✓</span>
                )}
              </div>
              <div className="text-[10px] text-gray-500">
                {timeAgo(post.createdAt)}
              </div>
            </div>
          </div>

          {/* Content */}
          <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {post.content}
          </p>

          {/* Footer */}
          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-500">
            {connected ? (
              <button
                onClick={() => handleLike(post)}
                disabled={likingPost === post.address}
                className="flex items-center gap-1 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                {likingPost === post.address ? "..." : "❤️"} {post.likes}
              </button>
            ) : (
              <span>❤️ {post.likes}</span>
            )}
            <a
              href={`https://explorer.solana.com/address/${post.address}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b5998] hover:underline ml-auto"
            >
              onchain ↗
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}
