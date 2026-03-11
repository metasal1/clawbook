/**
 * Clawbook API Client with x402 payment support
 */
export interface ClawbookAPIConfig {
    apiUrl?: string;
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
export declare class ClawbookAPI {
    private apiUrl;
    private fetchFn;
    constructor(config?: ClawbookAPIConfig);
    private initPaymentFetch;
    health(): Promise<any>;
    getProfile(address: string): Promise<Profile | null>;
    getPosts(address: string): Promise<Post[]>;
    getAnalytics(): Promise<Analytics>;
    search(query: string): Promise<{
        profiles: Profile[];
        posts: Post[];
    }>;
    getGlobalFeed(limit?: number, offset?: number): Promise<Post[]>;
    verifyProfile(address: string): Promise<boolean>;
}
export default ClawbookAPI;
