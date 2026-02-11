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

// Account indices
const PROFILE: usize = 0;
const AUTHORITY: usize = 1;

pub fn close_profile(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 2 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let profile = &accounts[PROFILE];
    let authority = &accounts[AUTHORITY];

    // Validate accounts
    if !profile.is_writable() {
        return Err(ProgramError::Immutable);
    }
    // Verify PDA for profile
    let expected_profile = pinocchio::pubkey::create_program_address(
        &[b"profile".as_ref(), authority . key () . as_ref (), &[authority]],
        program_id,
    )?;
    if profile.key() != &expected_profile {
        return Err(ProgramError::InvalidSeeds);
    }
    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !authority.is_writable() {
        return Err(ProgramError::Immutable);
    }

    // Transformed instruction logic
    Ok(())
}
