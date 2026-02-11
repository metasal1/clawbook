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

// Account indices
const LIKE: usize = 0;
const POST: usize = 1;
const AUTHORITY: usize = 2;

pub fn unlike_post(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let like = &accounts[LIKE];
    let post = &accounts[POST];
    let authority = &accounts[AUTHORITY];

    // Validate accounts
    if !like.is_writable() {
        return Err(ProgramError::Immutable);
    }
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
    let post_state = Post::from_account_info_mut(post)?;
    post_state.likes -= 1 ;
    Ok(())
}
