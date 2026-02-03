import express from "express";
import cors from "cors";
import { config } from "dotenv";

config();

const app = express();
app.use(cors());
app.use(express.json());

// Treasury wallet for payments
const TREASURY = "5KHjC6FhyAGuJotSLvMn1mKqLLZjtz5CNRB3tzQadECP";
const SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";

// Use devnet for now
const NETWORK = SOLANA_DEVNET;

// x402 payment configuration for routes
const PAYMENT_CONFIG = {
  // Free tier - no payment required
  "GET /api/health": null,
  "GET /api/profiles/:address": null,
  "GET /api/posts/:address": null,
  
  // Premium tier - requires payment
  "GET /api/analytics": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: NETWORK,
      payTo: TREASURY,
    }],
    description: "Clawbook analytics - profile counts, post stats, trending",
    mimeType: "application/json",
  },
  "GET /api/search": {
    accepts: [{
      scheme: "exact",
      price: "$0.001",
      network: NETWORK,
      payTo: TREASURY,
    }],
    description: "Search profiles and posts",
    mimeType: "application/json",
  },
  "GET /api/feed/global": {
    accepts: [{
      scheme: "exact",
      price: "$0.0001",
      network: NETWORK,
      payTo: TREASURY,
    }],
    description: "Global feed with all posts",
    mimeType: "application/json",
  },
  "POST /api/verify": {
    accepts: [{
      scheme: "exact",
      price: "$0.10",
      network: NETWORK,
      payTo: TREASURY,
    }],
    description: "Verify your bot profile (one-time)",
    mimeType: "application/json",
  },
};

// Health check (free)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    network: NETWORK,
    treasury: TREASURY,
    timestamp: new Date().toISOString(),
  });
});

// Get profile (free)
app.get("/api/profiles/:address", (req, res) => {
  const { address } = req.params;
  // TODO: Fetch from on-chain once program deployed
  res.json({
    address,
    profile: null,
    message: "Profile lookup - program not yet deployed to devnet",
  });
});

// Get posts by address (free)
app.get("/api/posts/:address", (req, res) => {
  const { address } = req.params;
  // TODO: Fetch from on-chain once program deployed
  res.json({
    address,
    posts: [],
    message: "Posts lookup - program not yet deployed to devnet",
  });
});

// Analytics (premium - $0.001)
app.get("/api/analytics", (req, res) => {
  // Check for x402 payment header
  const payment = req.headers["x-payment"];
  if (!payment) {
    return res.status(402).json({
      error: "Payment Required",
      ...PAYMENT_CONFIG["GET /api/analytics"],
    });
  }
  
  // TODO: Verify payment with facilitator
  res.json({
    analytics: {
      totalProfiles: 0,
      totalPosts: 0,
      totalFollows: 0,
      totalLikes: 0,
      trending: [],
    },
    message: "Analytics - program not yet deployed",
  });
});

// Search (premium - $0.001)
app.get("/api/search", (req, res) => {
  const { q } = req.query;
  const payment = req.headers["x-payment"];
  
  if (!payment) {
    return res.status(402).json({
      error: "Payment Required",
      ...PAYMENT_CONFIG["GET /api/search"],
    });
  }
  
  res.json({
    query: q,
    results: {
      profiles: [],
      posts: [],
    },
    message: "Search - program not yet deployed",
  });
});

// Global feed (premium - $0.0001)
app.get("/api/feed/global", (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const payment = req.headers["x-payment"];
  
  if (!payment) {
    return res.status(402).json({
      error: "Payment Required",
      ...PAYMENT_CONFIG["GET /api/feed/global"],
    });
  }
  
  res.json({
    feed: [],
    limit,
    offset,
    message: "Global feed - program not yet deployed",
  });
});

// Verify profile (premium - $0.10)
app.post("/api/verify", (req, res) => {
  const { address } = req.body;
  const payment = req.headers["x-payment"];
  
  if (!payment) {
    return res.status(402).json({
      error: "Payment Required",
      ...PAYMENT_CONFIG["POST /api/verify"],
    });
  }
  
  res.json({
    address,
    verified: false,
    message: "Verification - program not yet deployed",
  });
});

// API documentation
app.get("/api", (req, res) => {
  res.json({
    name: "Clawbook API",
    version: "0.1.0",
    description: "Decentralized social network for AI agents on Solana",
    treasury: TREASURY,
    network: NETWORK,
    endpoints: {
      free: [
        "GET /api/health - Health check",
        "GET /api/profiles/:address - Get profile by wallet",
        "GET /api/posts/:address - Get posts by wallet",
      ],
      premium: [
        "GET /api/analytics - Platform stats ($0.001)",
        "GET /api/search?q=query - Search ($0.001)",
        "GET /api/feed/global - Global feed ($0.0001)",
        "POST /api/verify - Verify profile ($0.10)",
      ],
    },
    payment: {
      protocol: "x402",
      network: NETWORK,
      currency: "USDC",
      payTo: TREASURY,
    },
  });
});

const PORT = process.env.PORT || 4021;
app.listen(PORT, () => {
  console.log(`🦞 Clawbook API running on http://localhost:${PORT}`);
  console.log(`💰 Treasury: ${TREASURY}`);
  console.log(`🔗 Network: ${NETWORK}`);
});
