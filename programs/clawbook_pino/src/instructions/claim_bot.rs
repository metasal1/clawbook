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
use crate::state::BotClaim;
use crate::state::HumanClaim;

// Account indices
const BOT_CLAIM: usize = 0;
const HUMAN_CLAIM: usize = 1;
const BOT_PROFILE: usize = 2;
const OWNER: usize = 3;
const SYSTEM_PROGRAM: usize = 4;

pub fn claim_bot(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // Validate account count
    if accounts.len() < 5 {
        return Err(ProgramError::NotEnoughAccountKeys);
    }

    // Get accounts
    let bot_claim = &accounts[BOT_CLAIM];
    let human_claim = &accounts[HUMAN_CLAIM];
    let bot_profile = &accounts[BOT_PROFILE];
    let owner = &accounts[OWNER];
    let system_program = &accounts[SYSTEM_PROGRAM];

    // Deserialize state accounts needed for validation
    let bot_profile_state = Profile::from_account_info(bot_profile)?;

    // Validate accounts
    // Verify PDA for bot_claim
    let (expected_bot_claim, _bump_bot_claim) = pinocchio::pubkey::find_program_address(
        &[b"bot_claim".as_ref(), bot_profile_state . authority . as_ref ()],
        program_id,
    );
    if bot_claim.key() != &expected_bot_claim {
        return Err(ProgramError::InvalidSeeds);
    }
    // Verify PDA for human_claim
    let (expected_human_claim, _bump_human_claim) = pinocchio::pubkey::find_program_address(
        &[b"human_claim".as_ref(), owner . key () . as_ref ()],
        program_id,
    );
    if human_claim.key() != &expected_human_claim {
        return Err(ProgramError::InvalidSeeds);
    }
    // Verify PDA for bot_profile
    let (expected_bot_profile, _bump_bot_profile) = pinocchio::pubkey::find_program_address(
        &[b"profile".as_ref(), bot_profile_state . authority . as_ref ()],
        program_id,
    );
    if bot_profile.key() != &expected_bot_profile {
        return Err(ProgramError::InvalidSeeds);
    }
    if !owner.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !owner.is_writable() {
        return Err(ProgramError::Immutable);
    }

    // Transformed instruction logic
    // Deserialize state accounts
    let mut bot_claim_state = BotClaim::from_account_info_mut(bot_claim)?;
    let mut human_claim_state = HumanClaim::from_account_info_mut(human_claim)?;
    let mut bot_profile_state = Profile::from_account_info_mut(bot_profile)?;
    let bot_profile = & bot_profile ;
    if !(bot_profile_state.account_type  == *AccountType::Bot) {
    return Err(Error::InvalidBotProfile.into());
    }
    ;
    bot_claim_state.owner = *owner.key () ;
    bot_claim_state.bot = bot_profile_state.authority ;
    bot_claim_state.claimed_at = Clock::get () ?.unix_timestamp ;
    human_claim_state.owner = *owner.key () ;
    human_claim_state.bot = bot_profile_state.authority ;
    human_claim_state.claimed_at = Clock::get () ?.unix_timestamp ;
    Ok(())
}
