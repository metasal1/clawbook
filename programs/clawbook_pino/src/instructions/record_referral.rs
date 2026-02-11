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
use crate::state::Referral;
use crate::state::ReferrerStats;

// Account indices
const REFERRAL: usize = 0;
const REFERRER_STATS: usize = 1;
const PROFILE: usize = 2;
const REFERRER_PROFILE: usize = 3;
const AUTHORITY: usize = 4;
const SYSTEM_PROGRAM: usize = 5;

pub fn record_referral(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 6 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let referral = &accounts[REFERRAL];
    let referrer_stats = &accounts[REFERRER_STATS];
    let profile = &accounts[PROFILE];
    let referrer_profile = &accounts[REFERRER_PROFILE];
    let authority = &accounts[AUTHORITY];
    let system_program = &accounts[SYSTEM_PROGRAM];

    // Deserialize state accounts needed for validation
    let profile_state = Profile::from_account_info(profile)?;
    let referrer_profile_state = Profile::from_account_info(referrer_profile)?;

    // Validate accounts
    // Verify PDA for referral
    let (expected_referral, _bump_referral) = pinocchio::pubkey::find_program_address(
        &[b"referral".as_ref(), authority . key () . as_ref ()],
        program_id,
    );
    if referral.key() != &expected_referral {
        return Err(ProgramError::InvalidSeeds);
    }
    // Verify PDA for referrer_stats
    let (expected_referrer_stats, _bump_referrer_stats) = pinocchio::pubkey::find_program_address(
        &[b"referrer_stats".as_ref(), referrer_profile_state . authority . as_ref ()],
        program_id,
    );
    if referrer_stats.key() != &expected_referrer_stats {
        return Err(ProgramError::InvalidSeeds);
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
    // Deserialize state accounts
    let mut referral_state = Referral::from_account_info_mut(referral)?;
    let mut referrer_stats_state = ReferrerStats::from_account_info_mut(referrer_stats)?;
    let mut referrer_profile_state = Profile::from_account_info_mut(referrer_profile)?;
    referral_state.referred = *authority.key () ;
    referral_state.referrer = referrer_profile_state.authority ;
    referral_state.created_at = Clock::get () ?.unix_timestamp ;
    referrer_stats_state.authority = referrer_profile_state.authority ;
    referrer_stats_state.referral_count += 1 ;
    Ok(())
}
