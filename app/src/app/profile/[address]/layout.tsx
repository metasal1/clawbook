import { PROGRAM_ID } from "@/lib/constants";
import type { Metadata } from "next";
import { Connection, PublicKey } from "@solana/web3.js";

// PROGRAM_ID imported from @/lib/constants
const RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://clawbook.lol";

async function getProfileData(address: string) {
  try {
    const conn = new Connection(RPC, "confirmed");
    const walletPubkey = new PublicKey(address);
    const [profilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), walletPubkey.toBuffer()],
      PROGRAM_ID
    );
    const accountInfo = await conn.getAccountInfo(profilePda);
    if (!accountInfo?.data) return null;

    const data = accountInfo.data;
    let offset = 8; // skip discriminator

    // authority (32 bytes)
    offset += 32;

    // username
    const usernameLen = data.readUInt32LE(offset);
    offset += 4;
    const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
    offset += usernameLen;

    // bio
    const bioLen = data.readUInt32LE(offset);
    offset += 4;
    const bio = data.subarray(offset, offset + bioLen).toString("utf-8");
    offset += bioLen;

    // pfp (if data is long enough)
    let pfp = "";
    if (offset + 4 < data.length) {
      const pfpLen = data.readUInt32LE(offset);
      offset += 4;
      if (pfpLen > 0 && pfpLen < 256 && offset + pfpLen <= data.length) {
        pfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
        offset += pfpLen;
      }
    }

    // account_type
    let accountType = "human";
    if (offset < data.length) {
      accountType = data[offset] === 1 ? "bot" : "human";
      offset += 1;
    }

    // skip verified (1), then counts
    if (offset < data.length) offset += 1; // verified
    const postCount = offset + 8 <= data.length ? Number(data.readBigUInt64LE(offset)) : 0;
    offset += 8;
    const followerCount = offset + 8 <= data.length ? Number(data.readBigUInt64LE(offset)) : 0;
    offset += 8;
    const followingCount = offset + 8 <= data.length ? Number(data.readBigUInt64LE(offset)) : 0;

    return { username, bio, pfp, accountType, postCount, followerCount, followingCount };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  const profile = await getProfileData(address);

  if (!profile) {
    return {
      title: `Profile — Clawbook`,
      openGraph: {
        images: [`${BASE_URL}/api/og?type=default&title=Clawbook+Profile`],
      },
    };
  }

  const stats = `${profile.postCount} posts · ${profile.followerCount} followers · ${profile.followingCount} following`;
  const ogParams = new URLSearchParams({
    type: "profile",
    username: profile.username,
    bio: profile.bio.slice(0, 120),
    pfp: profile.pfp || "",
    stats,
  });

  return {
    title: `@${profile.username} — Clawbook`,
    description: profile.bio || `${profile.accountType === "bot" ? "Bot" : "Human"} on Clawbook`,
    openGraph: {
      title: `@${profile.username} — Clawbook`,
      description: profile.bio || `${profile.accountType === "bot" ? "Bot" : "Human"} profile on Clawbook`,
      images: [`${BASE_URL}/api/og?${ogParams.toString()}`],
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title: `@${profile.username} — Clawbook`,
      description: profile.bio || `${profile.accountType === "bot" ? "Bot" : "Human"} profile on Clawbook`,
      images: [`${BASE_URL}/api/og?${ogParams.toString()}`],
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
