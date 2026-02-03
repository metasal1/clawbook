import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "Missing domain parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(`https://alldomains.id/api/check-domain/${domain}.molt`);
    const data = await res.json();

    const isTaken = data.exists === true ||
      (Array.isArray(data.exists) && data.exists.some((v: any) => v != null));

    return NextResponse.json({
      domain: `${domain}.molt`,
      available: !isTaken,
      price: data.domainPrice,
      raw: data,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
