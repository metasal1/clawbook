import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, publicKey, durationRate = 1 } = body;

    if (!domain || !publicKey) {
      return NextResponse.json({ error: "Missing domain or publicKey" }, { status: 400 });
    }

    const res = await fetch("https://alldomains.id/api/create-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        durationRate,
        tld: ".molt",
        publicKey,
        simulate: false,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
