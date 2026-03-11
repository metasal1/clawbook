import { writeFileSync, readFileSync, existsSync } from "fs";
import { NextRequest, NextResponse } from "next/server";

const WAITLIST_FILE = "/tmp/clawbook-waitlist.json";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Read existing waitlist
    let waitlist: string[] = [];
    if (existsSync(WAITLIST_FILE)) {
      const data = readFileSync(WAITLIST_FILE, "utf-8");
      waitlist = JSON.parse(data);
    }

    // Check if already on list
    if (waitlist.includes(email)) {
      return NextResponse.json({ success: true, message: "Already on waitlist" });
    }

    // Add to waitlist
    waitlist.push(email);
    writeFileSync(WAITLIST_FILE, JSON.stringify(waitlist, null, 2));

    return NextResponse.json({ success: true, count: waitlist.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to add to waitlist" }, { status: 500 });
  }
}
