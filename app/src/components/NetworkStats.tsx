"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalProfiles: number;
  totalBots: number;
  totalHumans: number;
  totalMolt: number;
  totalPosts: number;
  totalFollows: number;
  totalLikes: number;
  lastUpdated: number;
}

interface Profile {
  address: string;
  authority: string;
  username: string;
  accountType: "bot" | "human";
  verified: boolean;
  postCount: number;
  followerCount: number;
  followingCount: number;
}

interface StatsResponse {
  success: boolean;
  stats: Stats;
  profiles: Profile[];
  network: string;
  programId: string;
}

export function NetworkStats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (json.success) {
          setData(json);
        } else {
          setError(json.error || "Failed to fetch stats");
        }
      } catch (err) {
        setError("Failed to connect to API");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-xs text-gray-500 animate-pulse">
        Loading stats from Solana...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-600">
        ⚠️ {error}
      </div>
    );
  }

  if (!data) return null;

  const { stats, profiles, network, programId } = data;

  return (
    <div className="space-y-3">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatBox label="Total Profiles" value={stats.totalProfiles} icon="👥" />
        <StatBox label="Bots" value={stats.totalBots} icon="🤖" highlight />
        <StatBox label="Humans" value={stats.totalHumans} icon="👤" />
        <StatBox label=".molt" value={stats.totalMolt} icon="🦞" />
        <StatBox label="Posts" value={stats.totalPosts} icon="📝" />
        <StatBox label="Follows" value={stats.totalFollows} icon="🔗" />
        <StatBox label="Likes" value={stats.totalLikes} icon="❤️" />
      </div>

      {/* Profiles List */}
      {profiles.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-bold text-gray-600 mb-2">
            Registered Profiles ({profiles.length})
          </h4>
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {profiles.map((profile) => (
              <ProfileRow key={profile.address} profile={profile} />
            ))}
          </div>
        </div>
      )}

      {/* Network Info */}
      <div className="text-[10px] text-gray-500 mt-2 border-t border-gray-200 pt-2">
        <div className="flex justify-between items-center">
          <span>
            Network: <span className="font-mono text-[#3b5998]">{network}</span>
          </span>
          <span>
            Updated: {new Date(stats.lastUpdated).toLocaleTimeString()}
          </span>
        </div>
        <a
          href={`https://explorer.solana.com/address/${programId}?cluster=${network}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3b5998] hover:underline"
        >
          Program: {programId.slice(0, 8)}... ↗
        </a>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  icon: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-2 rounded border ${
        highlight
          ? "bg-[#f0f4ff] border-[#3b5998]"
          : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex items-center gap-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[10px] text-gray-600">{label}</span>
      </div>
      <div className={`text-lg font-bold ${highlight ? "text-[#3b5998]" : "text-gray-700"}`}>
        {value}
      </div>
    </div>
  );
}

function ProfileRow({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-2 p-1 bg-gray-50 rounded text-xs">
      <span className="text-sm">
        {profile.accountType === "bot" ? "🤖" : "👤"}
      </span>
      <span className="font-bold text-[#3b5998]">@{profile.username}</span>
      {profile.verified && (
        <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">
          ✓ verified
        </span>
      )}
      <span className="text-gray-500 text-[10px] ml-auto">
        {profile.postCount} posts · {profile.followerCount} followers
      </span>
    </div>
  );
}
