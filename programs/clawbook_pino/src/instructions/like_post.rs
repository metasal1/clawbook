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
use crate::state::Like;

// Account indices
const LIKE: usize = 0;
const POST: usize = 1;
const AUTHORITY: usize = 2;
const SYSTEM_PROGRAM: usize = 3;

pub fn like_post(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let like = &accounts[LIKE];
    let post = &accounts[POST];
    let authority = &accounts[AUTHORITY];
    let system_program = &accounts[SYSTEM_PROGRAM];

    // Validate accounts
    // Verify PDA for like
    let (expected_like, _bump_like) = pinocchio::pubkey::find_program_address(
        &[b"like".as_ref(), authority . key () . as_ref (), post . key () . as_ref ()],
        program_id,
    );
    if like.key() != &expected_like {
        return Err(ProgramError::InvalidSeeds);
    }
    if !post.is_writable() {
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
    let mut like_state = Like::from_account_info_mut(like)?;
    let post_state = Post::from_account_info_mut(post)?;
    like_state.user = *authority.key () ;
    like_state.post = *post.key () ;
    like_state.created_at = Clock::get () ?.unix_timestamp ;
    post_state.likes += 1 ;
    Ok(())
}
