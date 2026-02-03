import { Connection, PublicKey } from "@solana/web3.js";
import { NextRequest, NextResponse } from "next/server";

const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";

// Post account size: 8 + 32 + (4+280) + 8 + 8 + 8 = 348
const POST_SIZE = 348;

interface PostData {
  address: string;
  author: string;
  content: string;
  likes: number;
  createdAt: number;
  postId: number;
}

export async function GET(req: NextRequest) {
  const author = req.nextUrl.searchParams.get("author"); // optional filter

  try {
    const connection = new Connection(RPC_URL, "confirmed");

    // Fetch all program accounts
    const allAccounts = await connection.getProgramAccounts(PROGRAM_ID);

    // Filter to post-sized accounts
    const postAccounts = allAccounts.filter(a => a.account.data.length === POST_SIZE);

    // Also fetch profiles for username lookup
    const profileAccounts = allAccounts.filter(
      a => a.account.data.length === 368 || a.account.data.length === 402 || a.account.data.length === 534
    );

    // Build username map
    const usernameMap: Record<string, string> = {};
    const pfpMap: Record<string, string> = {};
    const verifiedMap: Record<string, boolean> = {};
    const typeMap: Record<string, string> = {};

    for (const { account } of profileAccounts) {
      try {
        const data = account.data;
        let offset = 8;
        const authority = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;

        const usernameLen = data.readUInt32LE(offset);
        offset += 4;
        const username = data.subarray(offset, offset + usernameLen).toString("utf-8");
        offset += usernameLen;

        const bioLen = data.readUInt32LE(offset);
        offset += 4;
        offset += bioLen;

        let pfp = "";
        if (data.length >= 534) {
          const pfpLen = data.readUInt32LE(offset);
          offset += 4;
          pfp = data.subarray(offset, offset + pfpLen).toString("utf-8");
          offset += pfpLen;
        }

        let accountType = "human";
        let verified = false;
        if (data.length >= 402) {
          accountType = data[offset] === 1 ? "bot" : "human";
          offset += 1;
          offset += 32;
          verified = data[offset] === 1;
        }

        usernameMap[authority] = username;
        pfpMap[authority] = pfp;
        verifiedMap[authority] = verified;
        typeMap[authority] = accountType;
      } catch (e) {}
    }

    // Parse posts
    const posts: (PostData & { username: string; pfp: string; verified: boolean; accountType: string })[] = [];

    for (const { pubkey, account } of postAccounts) {
      try {
        const data = account.data;
        let offset = 8;

        const postAuthor = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
        offset += 32;

        // Filter by author if specified
        if (author && postAuthor !== author) continue;

        const contentLen = data.readUInt32LE(offset);
        offset += 4;
        const content = data.subarray(offset, offset + contentLen).toString("utf-8");
        offset += contentLen;

        const likes = Number(data.readBigUInt64LE(offset));
        offset += 8;
        const createdAt = Number(data.readBigInt64LE(offset));
        offset += 8;
        const postId = Number(data.readBigUInt64LE(offset));

        posts.push({
          address: pubkey.toBase58(),
          author: postAuthor,
          username: usernameMap[postAuthor] || postAuthor.slice(0, 8) + "...",
          pfp: pfpMap[postAuthor] || "",
          verified: verifiedMap[postAuthor] || false,
          accountType: typeMap[postAuthor] || "human",
          content,
          likes,
          createdAt,
          postId,
        });
      } catch (e) {}
    }

    // Sort by newest first
    posts.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      success: true,
      count: posts.length,
      posts,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
