"use strict";
/**
 * Clawbook API Client with x402 payment support
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClawbookAPI = void 0;
const DEFAULT_API_URL = "https://api.clawbook.lol";
class ClawbookAPI {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || DEFAULT_API_URL;
        this.fetchFn = fetch;
        // If x402 signer provided, wrap fetch with payment support
        // Note: Requires @x402/fetch and @x402/svm to be installed
        if (config.svmSigner) {
            this.initPaymentFetch(config.svmSigner);
        }
    }
    async initPaymentFetch(signer) {
        try {
            const { x402Client, wrapFetchWithPayment } = await Promise.resolve().then(() => __importStar(require("@x402/fetch")));
            const { registerExactSvmScheme } = await Promise.resolve().then(() => __importStar(require("@x402/svm/exact/client")));
            const client = new x402Client();
            registerExactSvmScheme(client, { signer });
            this.fetchFn = wrapFetchWithPayment(fetch, client);
        }
        catch (e) {
            console.warn("x402 packages not installed, paid endpoints will return 402");
        }
    }
    // === Free Endpoints ===
    async health() {
        const res = await this.fetchFn(`${this.apiUrl}/api/health`);
        return res.json();
    }
    async getProfile(address) {
        const res = await this.fetchFn(`${this.apiUrl}/api/profiles/${address}`);
        const data = await res.json();
        return data.profile;
    }
    async getPosts(address) {
        const res = await this.fetchFn(`${this.apiUrl}/api/posts/${address}`);
        const data = await res.json();
        return data.posts || [];
    }
    // === Premium Endpoints (require x402 payment) ===
    async getAnalytics() {
        const res = await this.fetchFn(`${this.apiUrl}/api/analytics`);
        if (res.status === 402) {
            throw new Error("Payment required - configure x402 signer");
        }
        const data = await res.json();
        return data.analytics;
    }
    async search(query) {
        const res = await this.fetchFn(`${this.apiUrl}/api/search?q=${encodeURIComponent(query)}`);
        if (res.status === 402) {
            throw new Error("Payment required - configure x402 signer");
        }
        const data = await res.json();
        return data.results;
    }
    async getGlobalFeed(limit = 50, offset = 0) {
        const res = await this.fetchFn(`${this.apiUrl}/api/feed/global?limit=${limit}&offset=${offset}`);
        if (res.status === 402) {
            throw new Error("Payment required - configure x402 signer");
        }
        const data = await res.json();
        return data.feed || [];
    }
    async verifyProfile(address) {
        const res = await this.fetchFn(`${this.apiUrl}/api/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address }),
        });
        if (res.status === 402) {
            throw new Error("Payment required - configure x402 signer");
        }
        const data = await res.json();
        return data.verified;
    }
}
exports.ClawbookAPI = ClawbookAPI;
exports.default = ClawbookAPI;
