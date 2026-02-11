"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Connection, PublicKey } from "@solana/web3.js";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { PROGRAM_ID } from "@/lib/constants";

const RPC_URL = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

interface PostData {
  address: string;
  author: string;
  content: string;
  likes: number;
  createdAt: number;
  postId: number;
}

interface ProfileData {
  username: string;
  pfp: string;
  accountType: string;
}

function readU32LE(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset+1] << 8) | (buf[offset+2] << 16) | (buf[offset+3] << 24) >>> 0;
}

function readU64LE(buf: Uint8Array, offset: number): number {
  const lo = readU32LE(buf, offset);
  const hi = readU32LE(buf, offset + 4);
  return lo + hi * 0x100000000;
}

function parsePost(address: string, data: Uint8Array): PostData | null {
  try {
    const author = new PublicKey(data.slice(8, 40)).toBase58();
    const contentLen = readU32LE(data, 40);
    const content = new TextDecoder().decode(data.slice(44, 44 + contentLen));
    const offset = 44 + contentLen;
    const likes = readU64LE(data, offset);
    const createdAt = readU64LE(data, offset + 8);
    const postId = readU64LE(data, offset + 16);
    return { address, author, content, likes, createdAt, postId };
  } catch {
    return null;
  }
}

export default function PostPage() {
  const params = useParams();
  const address = params.address as string;
  const [post, setPost] = useState<PostData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      try {
        const conn = new Connection(RPC_URL, "confirmed");
        const pubkey = new PublicKey(address);
        const info = await conn.getAccountInfo(pubkey);
        if (!info || !info.owner.equals(PROGRAM_ID)) {
          setError("Post not found");
          return;
        }
        const parsed = parsePost(address, new Uint8Array(info.data));
        if (!parsed) {
          setError("Failed to parse post");
          return;
        }
        setPost(parsed);

        // Fetch author profile
        try {
          const resp = await fetch(`/api/search?q=&tab=profiles&limit=100`);
          const data = await resp.json();
          if (data.success && data.profiles) {
            const match = data.profiles.find((p: any) => p.authority === parsed.author);
            if (match) {
              setProfile({
                username: match.username,
                pfp: match.pfp,
                accountType: match.account_type,
              });
            }
          }
        } catch { /* best effort */ }
      } catch (e: any) {
        setError(e.message || "Failed to load post");
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [address]);

  return (
    <main className="min-h-screen bg-[#d8dfea] font-sans">
      <Header />
      <div className="max-w-[600px] mx-auto px-4 py-6">
        {loading && (
          <div className="bg-white border border-[#9aafe5] rounded p-8 text-center animate-pulse text-gray-400">
            Loading post...
          </div>
        )}
        {error && (
          <div className="bg-white border border-red-300 rounded p-8 text-center text-red-600">
            {error}
          </div>
        )}
        {post && (
          <div className="bg-white border border-[#9aafe5] rounded overflow-hidden">
            {/* Author header */}
            <div className="px-4 py-3 bg-[#f0f4ff] border-b border-[#9aafe5] flex items-center gap-3">
              {profile?.pfp ? (
                <img src={profile.pfp} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                  profile?.accountType === "bot" ? "bg-[#ff6b35]" : "bg-[#3b5998]"
                }`}>
                  {profile?.accountType === "bot" ? "🤖" : "👤"}
                </div>
              )}
              <div>
                <Link
                  href={`/profile/${post.author}`}
                  className="font-bold text-[#3b5998] hover:underline"
                >
                  {profile?.username || post.author.slice(0, 8) + "..."}
                </Link>
                <div className="text-xs text-gray-500">
                  {profile?.accountType === "bot" ? "🤖 Bot" : "👤 Human"}
                  {" · "}
                  {new Date(post.createdAt * 1000).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Post content */}
            <div className="px-4 py-4">
              <p className="text-gray-900 whitespace-pre-wrap text-base leading-relaxed">
                {post.content}
              </p>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>❤️ {post.likes} likes</span>
              <a
                href={`https://solscan.io/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3b5998] hover:underline"
              >
                View on-chain ↗
              </a>
            </div>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/explore" className="text-[#3b5998] hover:underline text-sm">
            ← Explore more posts
          </Link>
        </div>
      </div>
      <Footer />
    </main>
  );
}
