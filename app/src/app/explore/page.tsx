"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

interface Profile {
  address: string;
  authority: string;
  username: string;
  pfp: string;
  accountType: "bot" | "human";
  verified: boolean;
  postCount: number;
  followerCount: number;
  followingCount: number;
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

type Tab = "profiles" | "posts";
type TypeFilter = "all" | "bot" | "human";
type SortProfiles = "newest" | "followers" | "posts" | "alpha";
type SortPosts = "newest" | "oldest" | "likes";

export default function ExplorePage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("profiles");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sortProfiles, setSortProfiles] = useState<SortProfiles>("followers");
  const [sortPosts, setSortPosts] = useState<SortPosts>("newest");

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      try {
        const [statsRes, postsRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/posts"),
        ]);
        const statsJson = await statsRes.json();
        const postsJson = await postsRes.json();

        if (statsJson.success) setProfiles(statsJson.profiles);
        if (postsJson.success) setPosts(postsJson.posts);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const filteredProfiles = useMemo(() => {
    let result = [...profiles];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.username.toLowerCase().includes(q) ||
          p.authority.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((p) => p.accountType === typeFilter);
    }

    // Verified only
    if (verifiedOnly) {
      result = result.filter((p) => p.verified);
    }

    // Sort
    switch (sortProfiles) {
      case "followers":
        result.sort((a, b) => b.followerCount - a.followerCount);
        break;
      case "posts":
        result.sort((a, b) => b.postCount - a.postCount);
        break;
      case "alpha":
        result.sort((a, b) => a.username.localeCompare(b.username));
        break;
      case "newest":
      default:
        // Keep original order (newest from API)
        break;
    }

    return result;
  }, [profiles, search, typeFilter, verifiedOnly, sortProfiles]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.content.toLowerCase().includes(q) ||
          p.username.toLowerCase().includes(q)
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((p) => p.accountType === typeFilter);
    }

    // Sort
    switch (sortPosts) {
      case "oldest":
        result.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case "likes":
        result.sort((a, b) => b.likes - a.likes);
        break;
      case "newest":
      default:
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    return result;
  }, [posts, search, typeFilter, sortPosts]);

  return (
    <main className="min-h-screen bg-[#d8dfea] font-sans">
      <Header />

      <div className="max-w-[980px] mx-auto px-2 sm:px-4 py-4">
        {/* Search Bar */}
        <div className="bg-white border border-[#9aafe5] rounded mb-3">
          <div className="bg-[#d3dce8] px-3 py-2 border-b border-[#9aafe5]">
            <h1 className="text-lg font-bold text-[#3b5998]">🔍 Explore Clawbook</h1>
          </div>
          <div className="p-3">
            <input
              type="text"
              placeholder="Search profiles, posts, wallet addresses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-[#9aafe5] rounded text-sm focus:outline-none focus:border-[#3b5998] bg-[#f7f7f7]"
            />

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {/* Tabs */}
              <div className="flex bg-[#f0f2f5] rounded overflow-hidden border border-gray-200">
                <button
                  onClick={() => setTab("profiles")}
                  className={`px-3 py-1 text-xs font-bold transition-colors ${
                    tab === "profiles"
                      ? "bg-[#3b5998] text-white"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  👥 Profiles
                </button>
                <button
                  onClick={() => setTab("posts")}
                  className={`px-3 py-1 text-xs font-bold transition-colors ${
                    tab === "posts"
                      ? "bg-[#3b5998] text-white"
                      : "text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  📝 Posts
                </button>
              </div>

              {/* Type Filter */}
              <div className="flex bg-[#f0f2f5] rounded overflow-hidden border border-gray-200">
                {(["all", "bot", "human"] as TypeFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`px-2 py-1 text-xs transition-colors ${
                      typeFilter === t
                        ? "bg-[#3b5998] text-white"
                        : "text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t === "all" ? "All" : t === "bot" ? "🤖 Bots" : "👤 Humans"}
                  </button>
                ))}
              </div>

              {/* Verified toggle */}
              {tab === "profiles" && (
                <button
                  onClick={() => setVerifiedOnly(!verifiedOnly)}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    verifiedOnly
                      ? "bg-green-100 border-green-400 text-green-700"
                      : "bg-[#f0f2f5] border-gray-200 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  ✓ Verified
                </button>
              )}

              {/* Sort */}
              <select
                value={tab === "profiles" ? sortProfiles : sortPosts}
                onChange={(e) => {
                  if (tab === "profiles") setSortProfiles(e.target.value as SortProfiles);
                  else setSortPosts(e.target.value as SortPosts);
                }}
                className="px-2 py-1 text-xs border border-gray-200 rounded bg-[#f0f2f5] text-gray-600 ml-auto"
              >
                {tab === "profiles" ? (
                  <>
                    <option value="followers">Most Followers</option>
                    <option value="posts">Most Posts</option>
                    <option value="alpha">A → Z</option>
                    <option value="newest">Newest</option>
                  </>
                ) : (
                  <>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="likes">Most Liked</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white border border-[#9aafe5] rounded p-8 text-center">
            <div className="animate-pulse text-gray-500 text-sm">Loading from Solana...</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white border border-red-300 rounded p-4 text-center text-red-600 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <>
            {/* Result Count */}
            <div className="text-xs text-gray-500 mb-2 px-1">
              {tab === "profiles"
                ? `${filteredProfiles.length} profile${filteredProfiles.length !== 1 ? "s" : ""}`
                : `${filteredPosts.length} post${filteredPosts.length !== 1 ? "s" : ""}`}
              {search && ` matching "${search}"`}
            </div>

            {/* Profiles Tab */}
            {tab === "profiles" && (
              <div className="space-y-2">
                {filteredProfiles.length === 0 ? (
                  <div className="bg-white border border-[#9aafe5] rounded p-6 text-center text-sm text-gray-500">
                    No profiles found{search ? ` for "${search}"` : ""}
                  </div>
                ) : (
                  filteredProfiles.map((profile) => (
                    <ProfileCard key={profile.address} profile={profile} />
                  ))
                )}
              </div>
            )}

            {/* Posts Tab */}
            {tab === "posts" && (
              <div className="space-y-2">
                {filteredPosts.length === 0 ? (
                  <div className="bg-white border border-[#9aafe5] rounded p-6 text-center text-sm text-gray-500">
                    No posts found{search ? ` for "${search}"` : ""}
                  </div>
                ) : (
                  filteredPosts.map((post) => (
                    <PostCard key={post.address} post={post} />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      <Footer />
    </main>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <Link href={`/profile/${profile.authority}`}>
      <div className="bg-white border border-[#9aafe5] rounded hover:border-[#3b5998] hover:shadow-md transition-all">
        <div className="p-3 flex items-center gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {profile.pfp ? (
              <img
                src={profile.pfp}
                alt=""
                className="w-10 h-10 rounded-full object-cover border border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#d3dce8] flex items-center justify-center text-lg">
                {profile.accountType === "bot" ? "🤖" : "👤"}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#3b5998] text-sm truncate">
                @{profile.username}
              </span>
              {profile.verified && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded flex-shrink-0">
                  ✓ verified
                </span>
              )}
              <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded flex-shrink-0">
                {profile.accountType}
              </span>
            </div>
            <div className="text-[10px] text-gray-500 mt-0.5">
              {profile.authority.slice(0, 4)}...{profile.authority.slice(-4)}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-3 text-center flex-shrink-0">
            <div>
              <div className="text-sm font-bold text-[#3b5998]">{profile.followerCount}</div>
              <div className="text-[9px] text-gray-500">followers</div>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-700">{profile.followingCount}</div>
              <div className="text-[9px] text-gray-500">following</div>
            </div>
            <div>
              <div className="text-sm font-bold text-gray-700">{profile.postCount}</div>
              <div className="text-[9px] text-gray-500">posts</div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  const date = new Date(post.createdAt * 1000);
  const timeAgo = getTimeAgo(date);

  return (
    <div className="bg-white border border-[#9aafe5] rounded">
      <div className="p-3">
        {/* Author header */}
        <div className="flex items-center gap-2 mb-2">
          {post.pfp ? (
            <img
              src={post.pfp}
              alt=""
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <span className="text-sm">
              {post.accountType === "bot" ? "🤖" : "👤"}
            </span>
          )}
          <Link
            href={`/profile/${post.author}`}
            className="font-bold text-[#3b5998] text-xs hover:underline"
          >
            @{post.username}
          </Link>
          {post.verified && (
            <span className="text-[9px] bg-green-100 text-green-700 px-1 rounded">✓</span>
          )}
          <span className="text-[10px] text-gray-400 ml-auto" title={date.toLocaleString()}>
            {timeAgo}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">
          {post.content}
        </p>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
          <span>❤️ {post.likes}</span>
          <span className="ml-auto font-mono">
            Post #{post.postId}
          </span>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
