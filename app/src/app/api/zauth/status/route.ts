import { NextRequest, NextResponse } from "next/server";
import { createZAuthClient, validateResponse } from "@/lib/zauth";

/**
 * ZAuth Status Endpoint
 * 
 * Check ZAuth configuration and connectivity
 */
export async function GET(req: NextRequest) {
  const client = createZAuthClient();

  if (!client) {
    return NextResponse.json({
      success: false,
      enabled: false,
      message: "ZAuth not configured — set ZAUTH_API_KEY in environment",
    });
  }

  return NextResponse.json({
    success: true,
    enabled: true,
    config: {
      apiKey: client.apiKey.slice(0, 12) + "..." + client.apiKey.slice(-4),
      refundEnabled: client.refund?.enabled || false,
      hasEvmKey: !!client.refund?.privateKey,
      hasSolanaKey: !!client.refund?.solanaPrivateKey,
      maxRefundUsd: client.refund?.maxRefundUsd || 0,
      dailyCapUsd: client.refund?.dailyCapUsd || 0,
      monthlyCapUsd: client.refund?.monthlyCapUsd || 0,
    },
    timestamp: new Date().toISOString(),
  });
}
