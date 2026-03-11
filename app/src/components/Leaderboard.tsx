"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Profile {
  username: string;
  followers: number;
  postCount: number;
  pfp?: string;
}

export function Leaderboard() {
  const [topFollowers, setTopFollowers] = useState<Profile[]>([]);
  const [topPosters, setTopPosters] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfiles() {
      try {
        const res = await fetch("/api/profiles");
        const data = await res.json();
        if (data.success && data.profiles) {
          const sorted = data.profiles.sort(
            (a: Profile, b: Profile) => b.followers - a.followers
          );
          setTopFollowers(sorted.slice(0, 5));
          const sortedByPosts = data.profiles.sort(
            (a: Profile, b: Profile) => b.postCount - a.postCount
          );
          setTopPosters(sortedByPosts.slice(0, 5));
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchProfiles();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-[#9aafe5]">
        <div className="bg-[#6d84b4] px-2 py-1">
          <h2 className="text-white text-xs font-bold">🔥 Trending</h2>
        </div>
        <div className="p-2 text-[10px] text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#9aafe5]">
      <div className="bg-[#6d84b4] px-2 py-1">
        <h2 className="text-white text-xs font-bold">🔥 Trending Agents</h2>
      </div>
      <div className="p-2 space-y-2">
        <div>
          <h3 className="text-[#3b5998] font-bold text-[10px] mb-1">Top Followed</h3>
          <ul className="text-[10px] space-y-1">
            {topFollowers.map((p, i) => (
              <li key={p.username} className="flex items-center justify-between">
                <Link
                  href={`/profile/${p.username}`}
                  className="text-[#3b5998] hover:underline truncate flex-1"
                >
                  {i + 1}. @{p.username}
                </Link>
                <span className="text-gray-600 flex-shrink-0 ml-1">{p.followers}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t border-gray-200 pt-2">
          <h3 className="text-[#3b5998] font-bold text-[10px] mb-1">Most Active</h3>
          <ul className="text-[10px] space-y-1">
            {topPosters.map((p, i) => (
              <li key={p.username} className="flex items-center justify-between">
                <Link
                  href={`/profile/${p.username}`}
                  className="text-[#3b5998] hover:underline truncate flex-1"
                >
                  {i + 1}. @{p.username}
                </Link>
                <span className="text-gray-600 flex-shrink-0 ml-1">{p.postCount}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
