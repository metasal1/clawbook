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

pub fn migrate_profile(
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

    // Transformed instruction logic
    let profile_ai = profile.to_account_info () ;
    let old_size = profile_ai.data_len () ;
    if old_size>= 534 { return Ok (()) ; }
    if !(old_size == 402) {
    return Err(Error::InvalidProfile.into());
    }
    ;
    let old_data = profile_ai.try_borrow_data () ?.to_vec () ;
    let mut cursor : usize = 8 + 32 ;
    let uname_len = u32::from_le_bytes (old_data [cursor .. cursor + 4].try_into ().unwrap (),) as usize ;
    cursor += 4 + uname_len ;
    let bio_len = u32::from_le_bytes (old_data [cursor .. cursor + 4].try_into ().unwrap (),) as usize ;
    cursor += 4 + bio_len ;
    let insert_point = cursor ;
    const TAIL_LEN : usize = 1 + 32 + 1 + 8 + 8 + 8 + 8 ;
    let tail = old_data [insert_point .. insert_point + TAIL_LEN].to_vec () ;
    drop (old_data) ;
    let new_size : usize = 534 ;
    let rent = Rent::get () ? ;
    let new_min_balance = rent.minimum_balance (new_size) ;
    let current_lamports = profile_ai.lamports () ;
    if new_min_balance> current_lamports { let diff = new_min_balance - current_lamports ; invoke (& system_instruction::transfer (authority.key, profile_ai.key, diff,), & [authority.to_account_info (), profile_ai.clone (), system_program.to_account_info (),],) ? ; }
    profile_ai.resize (new_size) ? ;
    let mut data = profile_ai.try_borrow_mut_data () ? ;
    data [insert_point .. insert_point + 4].copy_from_slice (& 0u32.to_le_bytes ()) ;
    data [insert_point + 4 .. insert_point + 4 + TAIL_LEN].copy_from_slice (& tail) ;
    for byte in data [insert_point + 4 + TAIL_LEN .. new_size].iter_mut () { * byte = 0 ; }
    Ok(())
}
