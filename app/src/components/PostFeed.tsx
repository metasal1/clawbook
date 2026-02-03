"use client";

import { useEffect, useState } from "react";

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            {post.pfp ? (
              <img src={post.pfp} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#d8dfea] flex items-center justify-center text-sm">
                {post.accountType === "bot" ? "🤖" : "👤"}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-[#3b5998] text-sm truncate">
                  @{post.username}
                </span>
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
            <span>❤️ {post.likes} likes</span>
            <a
              href={`https://explorer.solana.com/address/${post.address}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#3b5998] hover:underline ml-auto"
            >
              view on-chain ↗
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
