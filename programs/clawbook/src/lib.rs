use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction};
use borsh::{BorshDeserialize, BorshSerialize};
use light_sdk::{
    account::LightAccount,
    address::v1::derive_address,
    cpi::{v1::{CpiAccounts, LightSystemProgramCpi}, InvokeLightSystemProgram, LightCpiInstruction},
    derive_light_cpi_signer,
    instruction::{PackedAddressTreeInfo, ValidityProof},
    CpiSigner, LightDiscriminator, PackedAddressTreeInfoExt,
};

declare_id!("12QGhHA9beYgva6a3XHhQQZrXpPcZVuPNvyeBKgRejsq");

/// CPI signer for Light Protocol compressed account operations.
pub const LIGHT_CPI_SIGNER: CpiSigner =
    derive_light_cpi_signer!("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");

#[program]
pub mod clawbook {
    use super::*;

    /// Create a new profile for a human (via web UI)
    pub fn create_profile(ctx: Context<CreateProfile>, username: String, bio: String, pfp: String) -> Result<()> {
        require!(username.len() <= 32, ClawbookError::UsernameTooLong);
        require!(bio.len() <= 256, ClawbookError::BioTooLong);
        require!(pfp.len() <= 128, ClawbookError::PfpTooLong);

        let profile = &mut ctx.accounts.profile;
        profile.authority = ctx.accounts.authority.key();
        profile.username = username;
        profile.bio = bio;
        profile.pfp = pfp;
        profile.account_type = AccountType::Human;
        profile.bot_proof_hash = [0u8; 32]; // No proof for humans
        profile.verified = false;
        profile.post_count = 0;
        profile.follower_count = 0;
        profile.following_count = 0;
        profile.created_at = Clock::get()?.unix_timestamp;
        
        Ok(())
    }

    /// Create a new profile for a bot (via SDK with proof)
    pub fn create_bot_profile(
        ctx: Context<CreateProfile>,
        username: String,
        bio: String,
        pfp: String,
        bot_proof_hash: [u8; 32],
    ) -> Result<()> {
        require!(username.len() <= 32, ClawbookError::UsernameTooLong);
        require!(bio.len() <= 256, ClawbookError::BioTooLong);
        require!(pfp.len() <= 128, ClawbookError::PfpTooLong);
        
        // Verify proof hash is not empty (actual verification happens off-chain)
        let empty_hash = [0u8; 32];
        require!(bot_proof_hash != empty_hash, ClawbookError::InvalidBotProof);

        let profile = &mut ctx.accounts.profile;
        profile.authority = ctx.accounts.authority.key();
        profile.username = username;
        profile.bio = bio;
        profile.pfp = pfp;
        profile.account_type = AccountType::Bot;
        profile.bot_proof_hash = bot_proof_hash;
        profile.verified = true; // Bots are verified by proof
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

    /// Create a compressed post using ZK Compression (Light Protocol).
    /// ~200x cheaper than regular posts — no rent required!
    /// Existing `create_post` is kept for backwards compatibility.
    pub fn create_compressed_post<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateCompressedPost<'info>>,
        proof: ValidityProof,
        address_tree_info: PackedAddressTreeInfo,
        output_tree_index: u8,
        content: String,
    ) -> Result<()> {
        require!(content.len() <= 280, ClawbookError::ContentTooLong);

        let light_cpi_accounts = CpiAccounts::new(
            ctx.accounts.fee_payer.as_ref(),
            ctx.remaining_accounts,
            crate::LIGHT_CPI_SIGNER,
        );

        // Derive a unique address for this compressed post using profile's post_count
        let post_count_bytes = ctx.accounts.profile.post_count.to_le_bytes();
        let (address, address_seed) = derive_address(
            &[
                b"compressed_post",
                ctx.accounts.fee_payer.key().as_ref(),
                &post_count_bytes,
            ],
            &address_tree_info
                .get_tree_pubkey(&light_cpi_accounts)
                .map_err(|_| error!(ClawbookError::LightCpiError))?,
            &crate::ID,
        );
        let new_address_params = address_tree_info.into_new_address_params_packed(address_seed);

        // Create the compressed post account
        let mut compressed_post = LightAccount::<CompressedPost>::new_init(
            &crate::ID,
            Some(address),
            output_tree_index,
        );

        compressed_post.author = ctx.accounts.fee_payer.key();
        compressed_post.content = content;
        compressed_post.likes = 0;
        compressed_post.created_at = Clock::get()?.unix_timestamp;
        compressed_post.post_id = ctx.accounts.profile.post_count;

        // Increment post count on the profile (shared counter for regular + compressed posts)
        let profile = &mut ctx.accounts.profile;
        profile.post_count += 1;

        // CPI to Light System Program to create the compressed account
        LightSystemProgramCpi::new_cpi(crate::LIGHT_CPI_SIGNER, proof)
            .with_light_account(compressed_post)
            .map_err(|_| error!(ClawbookError::LightCpiError))?
            .with_new_addresses(&[new_address_params])
            .invoke(light_cpi_accounts)
            .map_err(|_| error!(ClawbookError::LightCpiError))?;

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

    /// Close/delete a profile (only authority can close their own profile)
    pub fn close_profile(_ctx: Context<CloseProfile>) -> Result<()> {
        // Account closed via close = authority constraint, rent returned to authority
        Ok(())
    }

    /// Record a referral — called after profile creation when user has a referral code.
    /// Creates the referral link and increments referrer's stats.
    pub fn record_referral(ctx: Context<RecordReferral>) -> Result<()> {
        let referral = &mut ctx.accounts.referral;
        referral.referred = ctx.accounts.authority.key();
        referral.referrer = ctx.accounts.referrer_profile.authority;
        referral.created_at = Clock::get()?.unix_timestamp;

        let referrer_stats = &mut ctx.accounts.referrer_stats;
        referrer_stats.authority = ctx.accounts.referrer_profile.authority;
        referrer_stats.referral_count += 1;

        Ok(())
    }

    /// Update profile username, bio, and/or pfp
    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        username: Option<String>,
        bio: Option<String>,
        pfp: Option<String>,
    ) -> Result<()> {
        let profile = &mut ctx.accounts.profile;

        if let Some(new_username) = username {
            require!(new_username.len() <= 32, ClawbookError::UsernameTooLong);
            profile.username = new_username;
        }

        if let Some(new_bio) = bio {
            require!(new_bio.len() <= 256, ClawbookError::BioTooLong);
            profile.bio = new_bio;
        }

        if let Some(new_pfp) = pfp {
            require!(new_pfp.len() <= 128, ClawbookError::PfpTooLong);
            profile.pfp = new_pfp;
        }

        Ok(())
    }

    /// Migrate old profile (v2, 402 bytes, no pfp field) to new format (v3, 534 bytes, with pfp).
    /// Old profiles cause OOM when deserialized with the new schema because byte offsets shift.
    /// This instruction reads raw bytes, reallocs, and inserts an empty pfp field.
    /// Safe to call on already-migrated profiles (no-op).
    pub fn migrate_profile(ctx: Context<MigrateProfile>) -> Result<()> {
        let profile_ai = ctx.accounts.profile.to_account_info();
        let old_size = profile_ai.data_len();

        // Already new format — nothing to do
        if old_size >= 534 {
            return Ok(());
        }

        // Only handle known old format (402 bytes)
        require!(old_size == 402, ClawbookError::InvalidProfile);

        // --- 1. Read old data and find insert point ---
        let old_data = profile_ai.try_borrow_data()?.to_vec();

        // Old layout after 8-byte discriminator:
        //   authority(32) + username(4+N) + bio(4+M) + account_type(1) +
        //   bot_proof_hash(32) + verified(1) + post_count(8) +
        //   follower_count(8) + following_count(8) + created_at(8)
        // We insert pfp(4+0) between bio and account_type.

        let mut cursor: usize = 8 + 32; // skip discriminator + authority

        // Skip username (borsh string: 4-byte len prefix + data)
        let uname_len = u32::from_le_bytes(
            old_data[cursor..cursor + 4].try_into().unwrap(),
        ) as usize;
        cursor += 4 + uname_len;

        // Skip bio
        let bio_len = u32::from_le_bytes(
            old_data[cursor..cursor + 4].try_into().unwrap(),
        ) as usize;
        cursor += 4 + bio_len;

        let insert_point = cursor;

        // Remaining serialized fields: 1 + 32 + 1 + 8 + 8 + 8 + 8 = 66 bytes
        // (account_type + bot_proof_hash + verified + post_count + follower + following + created_at)
        const TAIL_LEN: usize = 1 + 32 + 1 + 8 + 8 + 8 + 8; // 66
        let tail = old_data[insert_point..insert_point + TAIL_LEN].to_vec();

        // Release borrow before realloc
        drop(old_data);

        // --- 2. Transfer additional rent for the larger account ---
        let new_size: usize = 534;
        let rent = Rent::get()?;
        let new_min_balance = rent.minimum_balance(new_size);
        let current_lamports = profile_ai.lamports();

        if new_min_balance > current_lamports {
            let diff = new_min_balance - current_lamports;
            invoke(
                &system_instruction::transfer(
                    ctx.accounts.authority.key,
                    profile_ai.key,
                    diff,
                ),
                &[
                    ctx.accounts.authority.to_account_info(),
                    profile_ai.clone(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // --- 3. Resize and rewrite data ---
        profile_ai.resize(new_size)?;

        let mut data = profile_ai.try_borrow_mut_data()?;

        // Insert empty pfp string: length prefix = 0 (4 bytes)
        data[insert_point..insert_point + 4].copy_from_slice(&0u32.to_le_bytes());

        // Write tail (account_type through created_at) right after pfp
        data[insert_point + 4..insert_point + 4 + TAIL_LEN].copy_from_slice(&tail);

        // Zero-fill any remaining bytes
        for byte in data[insert_point + 4 + TAIL_LEN..new_size].iter_mut() {
            *byte = 0;
        }

        Ok(())
    }
}

// === Account Type Enum ===

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum AccountType {
    #[default]
    Human = 0,
    Bot = 1,
}

// === Account Structures ===

#[account]
pub struct Profile {
    pub authority: Pubkey,          // 32 bytes
    pub username: String,           // 4 + 32 bytes
    pub bio: String,                // 4 + 256 bytes
    pub pfp: String,                // 4 + 128 bytes (URL/IPFS/Arweave)
    pub account_type: AccountType,  // 1 byte
    pub bot_proof_hash: [u8; 32],   // 32 bytes (SHA256 of proof)
    pub verified: bool,             // 1 byte
    pub post_count: u64,            // 8 bytes
    pub follower_count: u64,        // 8 bytes
    pub following_count: u64,       // 8 bytes
    pub created_at: i64,            // 8 bytes
}

// Profile space: 8 + 32 + (4+32) + (4+256) + (4+128) + 1 + 32 + 1 + 8 + 8 + 8 + 8 = 534 bytes

#[account]
pub struct Post {
    pub author: Pubkey,             // 32 bytes
    pub content: String,            // 4 + 280 bytes
    pub likes: u64,                 // 8 bytes
    pub created_at: i64,            // 8 bytes
    pub post_id: u64,               // 8 bytes
}

#[account]
pub struct FollowAccount {
    pub follower: Pubkey,           // 32 bytes
    pub following: Pubkey,          // 32 bytes
    pub created_at: i64,            // 8 bytes
}

#[account]
pub struct Like {
    pub user: Pubkey,               // 32 bytes
    pub post: Pubkey,               // 32 bytes
    pub created_at: i64,            // 8 bytes
}

#[account]
pub struct Referral {
    pub referred: Pubkey,           // 32 bytes — who was referred
    pub referrer: Pubkey,           // 32 bytes — who referred them
    pub created_at: i64,            // 8 bytes
}

// Referral space: 8 + 32 + 32 + 8 = 80 bytes

#[account]
pub struct ReferrerStats {
    pub authority: Pubkey,          // 32 bytes — the referrer
    pub referral_count: u64,        // 8 bytes — total referrals
}

// ReferrerStats space: 8 + 32 + 8 = 48 bytes

/// Compressed post stored via ZK Compression (Light Protocol).
/// No rent required — stored as a hash in a state Merkle tree.
#[derive(Clone, Debug, Default, BorshSerialize, BorshDeserialize, LightDiscriminator)]
pub struct CompressedPost {
    pub author: Pubkey,             // 32 bytes
    pub content: String,            // variable, max ~280 chars
    pub likes: u64,                 // 8 bytes
    pub created_at: i64,            // 8 bytes
    pub post_id: u64,               // 8 bytes
}

// === Contexts ===

#[derive(Accounts)]
#[instruction(username: String)]
pub struct CreateProfile<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + (4 + 32) + (4 + 256) + (4 + 128) + 1 + 32 + 1 + 8 + 8 + 8 + 8, // 534 bytes
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

/// Context for creating a compressed post via Light Protocol.
/// Light system program accounts are passed via remaining_accounts.
#[derive(Accounts)]
pub struct CreateCompressedPost<'info> {
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"profile", fee_payer.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, Profile>,
}

#[derive(Accounts)]
pub struct RecordReferral<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8, // 80 bytes
        seeds = [b"referral", authority.key().as_ref()],
        bump
    )]
    pub referral: Account<'info, Referral>,
    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + 32 + 8, // 48 bytes
        seeds = [b"referrer_stats", referrer_profile.authority.as_ref()],
        bump
    )]
    pub referrer_stats: Account<'info, ReferrerStats>,
    /// The referred user's profile — must exist
    #[account(
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, Profile>,
    /// The referrer's profile — must exist
    pub referrer_profile: Account<'info, Profile>,
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

#[derive(Accounts)]
pub struct CloseProfile<'info> {
    #[account(
        mut,
        close = authority,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub profile: Account<'info, Profile>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MigrateProfile<'info> {
    /// CHECK: Read raw bytes — account may be in old format (402 bytes, no pfp field)
    /// that cannot be deserialized as the current Profile struct.
    /// PDA seeds verify it's a valid profile address.
    #[account(
        mut,
        seeds = [b"profile", authority.key().as_ref()],
        bump
    )]
    pub profile: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// === Errors ===

#[error_code]
pub enum ClawbookError {
    #[msg("Username must be 32 characters or less")]
    UsernameTooLong,
    #[msg("Bio must be 256 characters or less")]
    BioTooLong,
    #[msg("PFP URL must be 128 characters or less")]
    PfpTooLong,
    #[msg("Content must be 280 characters or less")]
    ContentTooLong,
    #[msg("Invalid bot proof - hash cannot be empty")]
    InvalidBotProof,
    #[msg("Light Protocol CPI error")]
    LightCpiError,
    #[msg("Invalid profile format — expected 402-byte old format for migration")]
    InvalidProfile,
}
