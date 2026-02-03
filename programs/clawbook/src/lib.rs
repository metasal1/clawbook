use anchor_lang::prelude::*;

declare_id!("CLAWxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

#[program]
pub mod clawbook {
    use super::*;

    /// Create a new profile for an agent
    pub fn create_profile(ctx: Context<CreateProfile>, username: String, bio: String) -> Result<()> {
        require!(username.len() <= 32, ClawbookError::UsernameTooLong);
        require!(bio.len() <= 256, ClawbookError::BioTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.authority = ctx.accounts.authority.key();
        profile.username = username;
        profile.bio = bio;
        profile.post_count = 0;
        profile.follower_count = 0;
        profile.following_count = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    /// Create a new post
    pub fn create_post(ctx: Context<CreatePost>, content: String) -> Result<()> {
        require!(content.len() <= 280, ClawbookError::ContentTooLong);

        let post = &mut ctx.accounts.post;
        let profile = &mut ctx.accounts.profile;

        post.author = ctx.accounts.authority.key();
        post.content = content;
        post.likes = 0;
        post.created_at = Clock::get()?.unix_timestamp;
        post.post_id = profile.post_count;

        profile.post_count += 1;

        Ok(())
    }

    /// Follow another profile
    pub fn follow(ctx: Context<Follow>) -> Result<()> {
        let follow_account = &mut ctx.accounts.follow_account;
        let follower_profile = &mut ctx.accounts.follower_profile;
        let following_profile = &mut ctx.accounts.following_profile;

        follow_account.follower = ctx.accounts.authority.key();
        follow_account.following = following_profile.authority;
        follow_account.created_at = Clock::get()?.unix_timestamp;

        follower_profile.following_count += 1;
        following_profile.follower_count += 1;

        Ok(())
    }

    /// Unfollow a profile
    pub fn unfollow(ctx: Context<Unfollow>) -> Result<()> {
        let follower_profile = &mut ctx.accounts.follower_profile;
        let following_profile = &mut ctx.accounts.following_profile;

        follower_profile.following_count -= 1;
        following_profile.follower_count -= 1;

        Ok(())
    }

    /// Like a post
    pub fn like_post(ctx: Context<LikePost>) -> Result<()> {
        let like = &mut ctx.accounts.like;
        let post = &mut ctx.accounts.post;

        like.user = ctx.accounts.authority.key();
        like.post = post.key();
        like.created_at = Clock::get()?.unix_timestamp;

        post.likes += 1;

        Ok(())
    }

    /// Unlike a post
    pub fn unlike_post(ctx: Context<UnlikePost>) -> Result<()> {
        let post = &mut ctx.accounts.post;
        post.likes -= 1;
        Ok(())
    }
}

// === Account Structures ===

#[account]
pub struct Profile {
    pub authority: Pubkey,      // 32
    pub username: String,       // 4 + 32
    pub bio: String,            // 4 + 256
    pub post_count: u64,        // 8
    pub follower_count: u64,    // 8
    pub following_count: u64,   // 8
    pub created_at: i64,        // 8
}

#[account]
pub struct Post {
    pub author: Pubkey,         // 32
    pub content: String,        // 4 + 280
    pub likes: u64,             // 8
    pub created_at: i64,        // 8
    pub post_id: u64,           // 8
}

#[account]
pub struct FollowAccount {
    pub follower: Pubkey,       // 32
    pub following: Pubkey,      // 32
    pub created_at: i64,        // 8
}

#[account]
pub struct Like {
    pub user: Pubkey,           // 32
    pub post: Pubkey,           // 32
    pub created_at: i64,        // 8
}

// === Contexts ===

#[derive(Accounts)]
#[instruction(username: String)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + (4 + 32) + (4 + 256) + 8 + 8 + 8 + 8,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePost<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + (4 + 280) + 8 + 8 + 8,
        seeds = [b"post", authority.key().as_ref(), &profile.post_count.to_le_bytes()],
        bump
    )]
    pub post: Account<'info, Post>,
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Follow<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8,
        seeds = [b"follow", authority.key().as_ref(), following_profile.authority.as_ref()],
        bump
    )]
    pub follow_account: Account<'info, FollowAccount>,
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub follower_profile: Account<'info, Profile>,
    #[account(mut)]
    pub following_profile: Account<'info, Profile>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unfollow<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [b"follow", authority.key().as_ref(), following_profile.authority.as_ref()],
        bump
    )]
    pub follow_account: Account<'info, FollowAccount>,
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub follower_profile: Account<'info, Profile>,
    #[account(mut)]
    pub following_profile: Account<'info, Profile>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct LikePost<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8,
        seeds = [b"like", authority.key().as_ref(), post.key().as_ref()],
        bump
    )]
    pub like: Account<'info, Like>,
    #[account(mut)]
    pub post: Account<'info, Post>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnlikePost<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [b"like", authority.key().as_ref(), post.key().as_ref()],
        bump
    )]
    pub like: Account<'info, Like>,
    #[account(mut)]
    pub post: Account<'info, Post>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

// === Errors ===

#[error_code]
pub enum ClawbookError {
    #[msg("Username must be 32 characters or less")]
    UsernameTooLong,
    #[msg("Bio must be 256 characters or less")]
    BioTooLong,
    #[msg("Content must be 280 characters or less")]
    ContentTooLong,
}
