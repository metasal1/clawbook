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
const SYSTEM_PROGRAM: usize = 2;

pub fn create_bot_profile(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 3 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let profile = &accounts[PROFILE];
    let authority = &accounts[AUTHORITY];
    let system_program = &accounts[SYSTEM_PROGRAM];

    // Validate accounts
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
    // TODO: Parse username of type String at offset 0
    // TODO: Parse bio of type String at offset 0
    // TODO: Parse pfp of type String at offset 0
    let bot_proof_hash: [u8; 32] = data.get(0..32).ok_or(ProgramError::InvalidInstructionData)?.try_into().unwrap();

    // Transformed instruction logic
    // Deserialize state accounts
    let mut profile_state = Profile::from_account_info_mut(profile)?;
    if !(username.len () <= 32) {
    return Err(Error::UsernameTooLong.into());
    }
    ;
    if !(bio.len () <= 256) {
    return Err(Error::BioTooLong.into());
    }
    ;
    if !(pfp.len () <= 128) {
    return Err(Error::PfpTooLong.into());
    }
    ;
    let empty_hash = [0u8 ; 32] ;
    if !(bot_proof_hash  != *empty_hash) {
    return Err(Error::InvalidBotProof.into());
    }
    ;
    profile_state.authority = *authority.key () ;
    profile_state.username = username ;
    profile_state.bio = bio ;
    profile_state.pfp = pfp ;
    profile_state.account_type = AccountType::Bot ;
    profile_state.bot_proof_hash = bot_proof_hash ;
    profile_state.verified = true ;
    profile_state.post_count = 0 ;
    profile_state.follower_count = 0 ;
    profile_state.following_count = 0 ;
    profile_state.created_at = Clock::get () ?.unix_timestamp ;
    Ok(())
}
