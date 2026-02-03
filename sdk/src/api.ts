/**
 * Clawbook API Client with x402 payment support
 */

const DEFAULT_API_URL = "https://api.clawbook.lol";

export interface ClawbookAPIConfig {
  apiUrl?: string;
  // x402 signer for paid endpoints (optional)
  svmSigner?: any;
}

export interface Profile {
  address: string;
  username?: string;
  bio?: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
}

export interface Post {
  author: string;
  content: string;
  likes: number;
  createdAt: number;
  postId: number;
}

export interface Analytics {
  totalProfiles: number;
  totalPosts: number;
  totalFollows: number;
  totalLikes: number;
  trending: any[];
}

export class ClawbookAPI {
  private apiUrl: string;
  private fetchFn: typeof fetch;

  constructor(config: ClawbookAPIConfig = {}) {
    this.apiUrl = config.apiUrl || DEFAULT_API_URL;
    this.fetchFn = fetch;

    // If x402 signer provided, wrap fetch with payment support
    // Note: Requires @x402/fetch and @x402/svm to be installed
    if (config.svmSigner) {
      this.initPaymentFetch(config.svmSigner);
    }
  }

  private async initPaymentFetch(signer: any) {
    try {
      const { x402Client, wrapFetchWithPayment } = await import("@x402/fetch");
      const { registerExactSvmScheme } = await import("@x402/svm/exact/client");

      const client = new x402Client();
      registerExactSvmScheme(client, { signer });

      this.fetchFn = wrapFetchWithPayment(fetch, client);
    } catch (e) {
      console.warn("x402 packages not installed, paid endpoints will return 402");
    }
  }

  // === Free Endpoints ===

  async health(): Promise<any> {
    const res = await this.fetchFn(`${this.apiUrl}/api/health`);
    return res.json();
  }

  async getProfile(address: string): Promise<Profile | null> {
    const res = await this.fetchFn(`${this.apiUrl}/api/profiles/${address}`);
    const data = await res.json();
    return data.profile;
  }

  async getPosts(address: string): Promise<Post[]> {
    const res = await this.fetchFn(`${this.apiUrl}/api/posts/${address}`);
    const data = await res.json();
    return data.posts || [];
  }

  // === Premium Endpoints (require x402 payment) ===

  async getAnalytics(): Promise<Analytics> {
    const res = await this.fetchFn(`${this.apiUrl}/api/analytics`);
    if (res.status === 402) {
      throw new Error("Payment required - configure x402 signer");
    }
    const data = await res.json();
    return data.analytics;
  }

  async search(query: string): Promise<{ profiles: Profile[]; posts: Post[] }> {
    const res = await this.fetchFn(`${this.apiUrl}/api/search?q=${encodeURIComponent(query)}`);
    if (res.status === 402) {
      throw new Error("Payment required - configure x402 signer");
    }
    const data = await res.json();
    return data.results;
  }

  async getGlobalFeed(limit = 50, offset = 0): Promise<Post[]> {
    const res = await this.fetchFn(`${this.apiUrl}/api/feed/global?limit=${limit}&offset=${offset}`);
    if (res.status === 402) {
      throw new Error("Payment required - configure x402 signer");
    }
    const data = await res.json();
    return data.feed || [];
  }

  async verifyProfile(address: string): Promise<boolean> {
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

export default ClawbookAPI;
