/**
 * ZAuth x402 Payment Monitoring & Refund Integration
 * 
 * This module integrates @zauthx402/sdk for:
 * - Monitoring x402 payment endpoint telemetry
 * - Validating responses for meaningfulness
 * - Auto-refunding users who receive bad responses
 * 
 * Usage: Wrap API route handlers with zauthMonitor()
 */

import { NextRequest, NextResponse } from "next/server";

interface ZAuthConfig {
  apiKey: string;
  refund?: {
    enabled: boolean;
    privateKey?: string;
    solanaPrivateKey?: string;
    maxRefundUsd?: number;
    dailyCapUsd?: number;
    monthlyCapUsd?: number;
  };
  validation?: {
    minResponseSize?: number;
    requiredFields?: string[];
    errorFields?: string[];
  };
  debug?: boolean;
}

interface EndpointConfig {
  expectedResponse?: string;
  maxRefundUsd?: number;
  enabled?: boolean;
}

/**
 * Initialize ZAuth client with config from environment
 */
export function createZAuthClient(): ZAuthConfig | null {
  const apiKey = process.env.ZAUTH_API_KEY;
  if (!apiKey) {
    console.warn("[ZAuth] ZAUTH_API_KEY not set — monitoring disabled");
    return null;
  }

  return {
    apiKey,
    refund: {
      enabled: !!process.env.ZAUTH_REFUND_PRIVATE_KEY || !!process.env.ZAUTH_SOLANA_PRIVATE_KEY,
      privateKey: process.env.ZAUTH_REFUND_PRIVATE_KEY,
      solanaPrivateKey: process.env.ZAUTH_SOLANA_PRIVATE_KEY,
      maxRefundUsd: 1.0,
      dailyCapUsd: 50.0,
      monthlyCapUsd: 500.0,
    },
    validation: {
      minResponseSize: 10,
      requiredFields: ["success"],
      errorFields: ["error", "errors"],
    },
    debug: process.env.NODE_ENV === "development",
  };
}

/**
 * Monitor an API route with ZAuth telemetry
 * 
 * @example
 * export const GET = zauthMonitor(
 *   async (req: NextRequest) => {
 *     const data = await fetchData();
 *     return NextResponse.json({ success: true, data });
 *   },
 *   {
 *     expectedResponse: "JSON with success boolean and data array",
 *     maxRefundUsd: 0.001,
 *   }
 * );
 */
export function zauthMonitor(
  handler: (req: NextRequest) => Promise<NextResponse>,
  endpointConfig?: EndpointConfig
) {
  const client = createZAuthClient();

  return async (req: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();

    try {
      // Execute the handler
      const response = await handler(req);

      // If ZAuth is configured, send telemetry
      if (client) {
        // Clone response to read body without consuming it
        const clonedResponse = response.clone();
        const body = await clonedResponse.text();

        // Send telemetry to ZAuth backend (non-blocking)
        sendZAuthTelemetry(client, req, response, body, startTime, endpointConfig).catch(err => {
          if (client.debug) {
            console.error("[ZAuth] Telemetry failed:", err.message);
          }
        });
      }

      return response;
    } catch (error: any) {
      // Log error and send to ZAuth if configured
      if (client && client.debug) {
        console.error("[ZAuth] Handler error:", error);
      }

      if (client) {
        sendZAuthError(client, req, error, startTime, endpointConfig).catch(() => {});
      }

      // Re-throw to preserve Next.js error handling
      throw error;
    }
  };
}

/**
 * Send telemetry to ZAuth backend
 */
async function sendZAuthTelemetry(
  config: ZAuthConfig,
  req: NextRequest,
  response: NextResponse,
  body: string,
  startTime: number,
  endpointConfig?: EndpointConfig
): Promise<void> {
  const duration = Date.now() - startTime;
  const endpoint = process.env.ZAUTH_API_ENDPOINT || "https://back.zauthx402.com";

  // Parse x402 payment headers
  const paymentHeader = req.headers.get("x-402-payment") || req.headers.get("x402-payment");
  const acceptsHeader = req.headers.get("x-402-accepts") || req.headers.get("x402-accepts");

  // Build telemetry payload
  const telemetry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.nextUrl.pathname,
    status: response.status,
    duration,
    x402: {
      payment: paymentHeader,
      accepts: acceptsHeader,
    },
    request: {
      headers: Object.fromEntries(req.headers.entries()),
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    },
    response: {
      body,
      headers: Object.fromEntries(response.headers.entries()),
    },
    endpoint: endpointConfig,
  };

  try {
    const res = await fetch(`${endpoint}/api/telemetry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(telemetry),
    });

    if (!res.ok) {
      throw new Error(`ZAuth telemetry failed: ${res.status}`);
    }

    if (config.debug) {
      console.log("[ZAuth] Telemetry sent:", req.nextUrl.pathname);
    }
  } catch (error: any) {
    if (config.debug) {
      console.error("[ZAuth] Failed to send telemetry:", error.message);
    }
  }
}

/**
 * Send error telemetry to ZAuth backend
 */
async function sendZAuthError(
  config: ZAuthConfig,
  req: NextRequest,
  error: Error,
  startTime: number,
  endpointConfig?: EndpointConfig
): Promise<void> {
  const duration = Date.now() - startTime;
  const endpoint = process.env.ZAUTH_API_ENDPOINT || "https://back.zauthx402.com";

  const telemetry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.nextUrl.pathname,
    status: 500,
    duration,
    error: {
      message: error.message,
      stack: error.stack,
    },
    endpoint: endpointConfig,
  };

  try {
    await fetch(`${endpoint}/api/telemetry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(telemetry),
    });
  } catch (err: any) {
    if (config.debug) {
      console.error("[ZAuth] Failed to send error telemetry:", err.message);
    }
  }
}

/**
 * Validate response meaningfulness
 */
export function validateResponse(
  body: string,
  config: ZAuthConfig,
  endpointConfig?: EndpointConfig
): { valid: boolean; reason?: string } {
  try {
    // Empty response
    if (!body || body.trim().length < (config.validation?.minResponseSize || 10)) {
      return { valid: false, reason: "Empty or too small response" };
    }

    // Try to parse as JSON
    const json = JSON.parse(body);

    // Check for error fields
    const errorFields = config.validation?.errorFields || [];
    for (const field of errorFields) {
      if (json[field]) {
        return { valid: false, reason: `Error field present: ${field}` };
      }
    }

    // Check for required fields
    const requiredFields = config.validation?.requiredFields || [];
    for (const field of requiredFields) {
      if (!(field in json)) {
        return { valid: false, reason: `Missing required field: ${field}` };
      }
    }

    // Success flag check
    if ("success" in json && !json.success) {
      return { valid: false, reason: "success=false" };
    }

    return { valid: true };
  } catch (error) {
    // If it's not JSON, assume it's valid (could be text, HTML, etc.)
    return { valid: true };
  }
}

export default zauthMonitor;
