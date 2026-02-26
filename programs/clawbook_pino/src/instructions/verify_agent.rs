#![allow(unused_variables, unused_imports)]

use pinocchio::{
    account_info::AccountInfo,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
    system_program,
};

use crate::state::Profile;

// Account indices
const PROFILE: usize = 0;
const AUTHORITY: usize = 1;
const TREASURY: usize = 2;
const SYSTEM_PROGRAM: usize = 3;

/// Treasury wallet: 8iLn3JJRujBUtes3FdV9ethaLDjhcjZSWNRadKmWTtBP
const TREASURY_PUBKEY: [u8; 32] = [
    0x6c, 0x5e, 0x9d, 0x3f, 0xa1, 0x82, 0x5c, 0xb2,
    0xd4, 0x11, 0x73, 0x8e, 0x2a, 0x6f, 0x9c, 0x4d,
    0xe0, 0x5b, 0x7c, 0x1a, 0x23, 0xf8, 0x9e, 0x60,
    0xd5, 0x47, 0xba, 0x3c, 0x91, 0x2e, 0x58, 0x04,
];

/// 0.1 SOL in lamports
const VERIFY_FEE_LAMPORTS: u64 = 100_000_000;

pub fn verify_agent(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    if accounts.len() < 4 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    let profile = &accounts[PROFILE];
    let authority = &accounts[AUTHORITY];
    let treasury = &accounts[TREASURY];
    let system_program = &accounts[SYSTEM_PROGRAM];

    // Verify authority is signer
    if !authority.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }

    // Verify profile PDA
    let (expected_profile, _bump) = pinocchio::pubkey::find_program_address(
        &[b"profile".as_ref(), authority.key().as_ref()],
        program_id,
    );
    if profile.key() != &expected_profile {
        return Err(ProgramError::InvalidSeeds);
    }

    // Verify treasury account
    if treasury.key().as_ref() != TREASURY_PUBKEY.as_ref() {
        return Err(ProgramError::InvalidAccountData);
    }

    // Transfer 0.1 SOL from authority to treasury
    pinocchio::system_program::transfer(authority, treasury, VERIFY_FEE_LAMPORTS)?;

    // Set verified = true on the profile
    let profile_state = Profile::from_account_info_mut(profile)?;
    profile_state.verified = true;

    Ok(())
}
