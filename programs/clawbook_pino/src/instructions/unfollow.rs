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
use crate::state::Profile;

// Account indices
const FOLLOW_ACCOUNT: usize = 0;
const FOLLOWER_PROFILE: usize = 1;
const FOLLOWING_PROFILE: usize = 2;
const AUTHORITY: usize = 3;

pub fn unfollow(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let follow_account = &accounts[FOLLOW_ACCOUNT];
    let follower_profile = &accounts[FOLLOWER_PROFILE];
    let following_profile = &accounts[FOLLOWING_PROFILE];
    let authority = &accounts[AUTHORITY];

    // Deserialize state accounts needed for validation
    let following_profile_state = Profile::from_account_info(following_profile)?;

    // Validate accounts
    if !follow_account.is_writable() {
        return Err(ProgramError::Immutable);
    }
    // Verify PDA for follow_account
    let (expected_follow_account, _bump_follow_account) = pinocchio::pubkey::find_program_address(
        &[b"follow".as_ref(), authority . key () . as_ref (), following_profile_state . authority . as_ref ()],
        program_id,
    );
    if follow_account.key() != &expected_follow_account {
        return Err(ProgramError::InvalidSeeds);
    }
    if !follower_profile.is_writable() {
        return Err(ProgramError::Immutable);
    }
    // Verify PDA for follower_profile
    let (expected_follower_profile, _bump_follower_profile) = pinocchio::pubkey::find_program_address(
        &[b"profile".as_ref(), authority . key () . as_ref ()],
        program_id,
    );
    if follower_profile.key() != &expected_follower_profile {
        return Err(ProgramError::InvalidSeeds);
    }
    if !following_profile.is_writable() {
        return Err(ProgramError::Immutable);
    }
    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !authority.is_writable() {
        return Err(ProgramError::Immutable);
    }

    // Transformed instruction logic
    // Deserialize state accounts
    let follower_profile_state = Profile::from_account_info_mut(follower_profile)?;
    let following_profile_state = Profile::from_account_info_mut(following_profile)?;
    follower_profile_state.following_count -= 1 ;
    following_profile_state.follower_count -= 1 ;
    Ok(())
}
