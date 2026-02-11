#![allow(unused_variables, unused_imports)]

use pinocchio::{
    account_info::AccountInfo,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
    sysvars::{clock::Clock, Sysvar},
};

use crate::error::Error;
use crate::helpers::*;
use crate::state::Post;
use crate::state::Profile;

// Account indices
const POST: usize = 0;
const PROFILE: usize = 1;
const AUTHORITY: usize = 2;
const SYSTEM_PROGRAM: usize = 3;

pub fn create_post(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let post = &accounts[POST];
    let profile = &accounts[PROFILE];
    let authority = &accounts[AUTHORITY];
    let system_program = &accounts[SYSTEM_PROGRAM];

    // Deserialize state accounts needed for validation
    let profile_state = Profile::from_account_info(profile)?;

    // Validate accounts
    // Verify PDA for post
    let (expected_post, _bump_post) = pinocchio::pubkey::find_program_address(
        &[b"post".as_ref(), authority . key () . as_ref (), & profile_state.post_count . to_le_bytes ().as_ref()],
        program_id,
    );
    if post.key() != &expected_post {
        return Err(ProgramError::InvalidSeeds);
    }
    if !profile.is_writable() {
        return Err(ProgramError::Immutable);
    }
    // Verify PDA for profile
    let (expected_profile, _bump_profile) = pinocchio::pubkey::find_program_address(
        &[b"profile".as_ref(), authority . key () . as_ref ()],
        program_id,
    );
    if profile.key() != &expected_profile {
        return Err(ProgramError::InvalidSeeds);
    }
    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !authority.is_writable() {
        return Err(ProgramError::Immutable);
    }

    // Parse instruction arguments
    // TODO: Parse content of type String at offset 0

    // Transformed instruction logic
    // Deserialize state accounts
    let mut post_state = Post::from_account_info_mut(post)?;
    let profile_state = Profile::from_account_info_mut(profile)?;
    if !(content.len () <= 280) {
    return Err(Error::ContentTooLong.into());
    }
    ;
    post_state.author = *authority.key () ;
    post_state.content = content ;
    post_state.likes = 0 ;
    post_state.created_at = Clock::get () ?.unix_timestamp ;
    post_state.post_id = profile_state.post_count ;
    profile_state.post_count += 1 ;
    Ok(())
}
