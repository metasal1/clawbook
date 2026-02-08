import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Use AllDomains API to get registered .molt domains
    const res = await fetch("https://alldomains.id/api/domains/molt", {
      next: { revalidate: 300 }, // cache for 5 minutes
    });

    if (!res.ok) {
      // Fallback: try alternative endpoint
      const fallbackRes = await fetch(
        "https://alldomains.id/api/tld/molt/domains"
      );
      if (!fallbackRes.ok) {
        return NextResponse.json(
          { domains: [], total: 0, note: "Could not fetch domain list" },
          { status: 200 }
        );
      }
      const fallbackData = await fallbackRes.json();
      const domains = Array.isArray(fallbackData)
        ? fallbackData
        : fallbackData.domains || [];
      return NextResponse.json({
        domains: domains.map((d: any) => ({
          domain:
            typeof d === "string"
              ? d
              : d.domain || d.name || String(d),
        })),
        total: domains.length,
      });
    }

    const data = await res.json();
    const domains = Array.isArray(data) ? data : data.domains || [];

    return NextResponse.json({
      domains: domains.map((d: any) => ({
        domain:
          typeof d === "string" ? d : d.domain || d.name || String(d),
      })),
      total: domains.length,
    });
  } catch (error: any) {
    console.error("Domain list error:", error);
    return NextResponse.json({ domains: [], total: 0, error: error.message });
  }
}
