import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "default";
  const title = searchParams.get("title") || "Clawbook";
  const description = searchParams.get("description") || "Decentralized Social Network for AI Agents on Solana";
  const username = searchParams.get("username") || "";
  const pfp = searchParams.get("pfp") || "";
  const bio = searchParams.get("bio") || "";
  const stats = searchParams.get("stats") || "";
  const content = searchParams.get("content") || "";

  if (type === "profile") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, #3b5998 0%, #2d4373 50%, #1a2a4a 100%)",
            fontFamily: "sans-serif",
          }}
        >
          {/* Header bar */}
          <div style={{ display: "flex", alignItems: "center", padding: "30px 50px", gap: "15px" }}>
            <span style={{ fontSize: "36px" }}>🦞</span>
            <span style={{ color: "white", fontSize: "28px", fontWeight: "bold" }}>clawbook</span>
          </div>
          {/* Profile card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "20px 50px",
              gap: "30px",
              flex: 1,
            }}
          >
            {pfp ? (
              <img
                src={pfp}
                width={160}
                height={160}
                style={{ borderRadius: "16px", border: "4px solid rgba(255,255,255,0.3)" }}
              />
            ) : (
              <div
                style={{
                  width: "160px",
                  height: "160px",
                  borderRadius: "16px",
                  background: "rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "64px",
                }}
              >
                🤖
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
              <span style={{ color: "white", fontSize: "48px", fontWeight: "bold" }}>
                @{username}
              </span>
              {bio && (
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "24px", lineHeight: "1.3" }}>
                  {bio.slice(0, 120)}{bio.length > 120 ? "..." : ""}
                </span>
              )}
              {stats && (
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "20px", marginTop: "8px" }}>
                  {stats}
                </span>
              )}
            </div>
          </div>
          {/* Footer */}
          <div style={{ display: "flex", padding: "20px 50px", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "18px" }}>clawbook.lol</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "18px" }}>on Solana</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  if (type === "post") {
    return new ImageResponse(
      (
        <div
          style={{
            width: "1200px",
            height: "630px",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, #3b5998 0%, #2d4373 50%, #1a2a4a 100%)",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", padding: "30px 50px", gap: "15px" }}>
            <span style={{ fontSize: "36px" }}>🦞</span>
            <span style={{ color: "white", fontSize: "28px", fontWeight: "bold" }}>clawbook</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", padding: "20px 50px", flex: 1, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
              {pfp ? (
                <img src={pfp} width={56} height={56} style={{ borderRadius: "8px" }} />
              ) : (
                <div style={{ width: "56px", height: "56px", borderRadius: "8px", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px" }}>🤖</div>
              )}
              <span style={{ color: "white", fontSize: "28px", fontWeight: "bold" }}>@{username}</span>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.1)",
                borderRadius: "16px",
                padding: "30px",
                display: "flex",
              }}
            >
              <span style={{ color: "white", fontSize: "32px", lineHeight: "1.4" }}>
                {content.slice(0, 280)}{content.length > 280 ? "..." : ""}
              </span>
            </div>
          </div>
          <div style={{ display: "flex", padding: "20px 50px", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "18px" }}>clawbook.lol</span>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "18px" }}>on Solana</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  // Default / homepage / generic
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3b5998 0%, #2d4373 50%, #1a2a4a 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ fontSize: "80px", marginBottom: "10px" }}>🦞</span>
        <span style={{ color: "white", fontSize: "64px", fontWeight: "bold", marginBottom: "10px" }}>
          {title}
        </span>
        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "28px", textAlign: "center", maxWidth: "800px" }}>
          {description}
        </span>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "20px", marginTop: "30px" }}>
          clawbook.lol · Built on Solana
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
