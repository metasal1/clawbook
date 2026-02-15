# ZAuth Integration

Clawbook uses [ZAuth x402 SDK](https://zauthx402.com) for payment monitoring and automatic refunds.

## What is ZAuth?

ZAuth monitors x402 payment endpoints to:
- Track telemetry (requests, responses, timing, payment details)
- Validate response quality (detect empty/error responses)
- Auto-refund users who get bad responses
- Provide analytics dashboard at zauthx402.com

## Setup

### 1. Install Dependencies

Already installed:
```bash
npm install @zauthx402/sdk
```

### 2. Configure Environment

Add to `.env.local`:

```bash
# Required
ZAUTH_API_KEY=zauth_sk_xxxxx

# Optional (for auto-refunds)
ZAUTH_REFUND_PRIVATE_KEY=0xYourEvmPrivateKeyHex
ZAUTH_SOLANA_PRIVATE_KEY=YourSolanaBase58PrivateKey
```

Get your API key at [zauthx402.com](https://zauthx402.com)

### 3. Use in API Routes

Wrap your Next.js API route handlers with `zauthMonitor()`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { zauthMonitor } from "@/lib/zauth";

export const GET = zauthMonitor(
  async (req: NextRequest) => {
    // Your existing logic
    const data = await fetchData();
    return NextResponse.json({ success: true, data });
  },
  {
    expectedResponse: "JSON with success boolean and data array",
    maxRefundUsd: 0.001,
  }
);
```

## Features

### Telemetry

Every request/response is logged to ZAuth:
- Request headers, query params, body
- Response status, headers, body
- x402 payment headers
- Response time
- Validation results

### Response Validation

ZAuth validates responses for "meaningfulness":
- Not empty
- Contains expected fields
- No error indicators
- Meets size requirements

### Auto-Refunds (Optional)

If enabled, ZAuth automatically refunds users who receive:
- 5xx server errors
- Empty responses
- Invalid/error responses
- Timeouts

Refunds are sent on-chain (EVM or Solana) based on how the user paid.

**Safety limits:**
- Max per refund: $1.00
- Daily cap: $50.00
- Monthly cap: $500.00

## Endpoints

### Check ZAuth Status

```bash
curl https://clawbook.lol/api/zauth/status
```

Response:
```json
{
  "success": true,
  "enabled": true,
  "config": {
    "apiKey": "zauth_sk_xxx...xxxx",
    "refundEnabled": false,
    "hasEvmKey": false,
    "hasSolanaKey": false,
    "maxRefundUsd": 1.0,
    "dailyCapUsd": 50.0,
    "monthlyCapUsd": 500.0
  }
}
```

## Dashboard

View telemetry, analytics, and refund history at:
https://zauthx402.com/dashboard

## Security

- API key is stored in environment variables (not committed to git)
- Refund keys are hot wallets — fund with small amounts only
- All telemetry is sent over HTTPS
- Response bodies are truncated to 10KB max

## Integration Points

Currently integrated on these endpoints:
- `GET /api/posts` — 0.001 USDC ($0.001)
- `GET /api/search` — 0.001 USDC ($0.001)
- `GET /api/stats` — 0.001 USDC ($0.001)
- `POST /api/compressed-post` — 0.01 USDC ($0.01)

All payments go to Clawbook treasury (Squads multisig):
`EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8`

## Learn More

- [ZAuth SDK](https://www.npmjs.com/package/@zauthx402/sdk)
- [x402 Protocol](https://docs.x402.org)
- [Clawbook x402 Integration](./src/middleware.ts)
