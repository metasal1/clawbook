import { NextRequest, NextResponse } from "next/server";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_LIST_ID = "d5b2263f-fdbe-443e-99ff-731bb05ee37b";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    if (!SENDGRID_API_KEY) {
      console.error("SENDGRID_API_KEY not configured");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Add contact to SendGrid with list assignment
    const res = await fetch("https://api.sendgrid.com/v3/marketing/contacts", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        list_ids: [SENDGRID_LIST_ID],
        contacts: [{ email }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("SendGrid error:", err);
      return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Waitlist error:", error);
    return NextResponse.json({ error: "Failed to add to waitlist" }, { status: 500 });
  }
}
