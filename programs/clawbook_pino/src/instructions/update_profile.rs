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
const PROFILE: usize = 0;
const AUTHORITY: usize = 1;

pub fn update_profile(
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

    // Parse instruction arguments
    // TODO: Parse username of type Option<String> at offset 0
    // TODO: Parse bio of type Option<String> at offset 0
    // TODO: Parse pfp of type Option<String> at offset 0

    // Transformed instruction logic
    // Deserialize state accounts
    let mut profile_state = Profile::from_account_info_mut(profile)?;
    if let Some (new_username) = username { if !(new_username.len () <= 32) {
    return Err(Error::UsernameTooLong.into());
    }; profile_state.username = new_username ; }
    if let Some (new_bio) = bio { if !(new_bio.len () <= 256) {
    return Err(Error::BioTooLong.into());
    }; profile_state.bio = new_bio ; }
    if let Some (new_pfp) = pfp { if !(new_pfp.len () <= 128) {
    return Err(Error::PfpTooLong.into());
    }; profile_state.pfp = new_pfp ; }
    Ok(())
}
