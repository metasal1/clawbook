#![no_std]
#![allow(unexpected_cfgs)]

use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    pubkey::Pubkey,
    ProgramResult,
};

mod state;
mod error;
mod helpers;
mod instructions;

pub use state::*;
pub use error::*;
pub use helpers::*;

/// Program ID: 3mMxY4XcKrkPDHdLbUkssYy34smQtfhwBcfnMpLcBbZy
pub const ID: [u8; 32] = [
    0x29, 0x14, 0xa0, 0x4d, 0x8a, 0x2f, 0x23, 0x88, 
    0x1d, 0x0e, 0x41, 0x76, 0x8f, 0xf9, 0x38, 0x46, 
    0x97, 0xb1, 0x1f, 0xf9, 0xbc, 0x25, 0x2a, 0x7f, 
    0x1e, 0xdd, 0xee, 0x30, 0x46, 0x2c, 0x4c, 0xa0, 
];

#[cfg(not(feature = "no-entrypoint"))]
use pinocchio::entrypoint;
#[cfg(not(feature = "no-entrypoint"))]
entrypoint!(process_instruction);

#[cfg(target_os = "solana")]
#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

// Instruction discriminators (Anchor-compatible)
const CREATE_PROFILE_DISC: [u8; 8] = [0xe1, 0xcd, 0xea, 0x8f, 0x11, 0xba, 0x32, 0xdc];
const CREATE_BOT_PROFILE_DISC: [u8; 8] = [0x53, 0x76, 0x94, 0x46, 0x5f, 0x64, 0xc4, 0xd7];
const CREATE_POST_DISC: [u8; 8] = [0x7b, 0x5c, 0xb8, 0x1d, 0xe7, 0x18, 0x0f, 0xca];
const CREATE_COMPRESSED_POST_DISC: [u8; 8] = [0xea, 0x27, 0x1e, 0xd3, 0x19, 0xc6, 0x9c, 0xe6];
const FOLLOW_DISC: [u8; 8] = [0xa1, 0x3d, 0x96, 0x7a, 0xa4, 0x99, 0x00, 0x12];
const UNFOLLOW_DISC: [u8; 8] = [0x7a, 0x2f, 0x18, 0xa1, 0x0c, 0x55, 0xe0, 0x44];
const LIKE_POST_DISC: [u8; 8] = [0x2d, 0xf2, 0x9a, 0x47, 0x3f, 0x85, 0x36, 0xba];
const UNLIKE_POST_DISC: [u8; 8] = [0xec, 0x3f, 0x06, 0x22, 0x80, 0x03, 0x72, 0xae];
const CLOSE_PROFILE_DISC: [u8; 8] = [0xa7, 0x24, 0xb5, 0x08, 0x88, 0x9e, 0x2e, 0xcf];
const RECORD_REFERRAL_DISC: [u8; 8] = [0xe8, 0x09, 0xf2, 0x33, 0xed, 0x10, 0xac, 0x48];
const UPDATE_PROFILE_DISC: [u8; 8] = [0x62, 0x43, 0x63, 0xce, 0x56, 0x73, 0xaf, 0x01];
const CLAIM_BOT_DISC: [u8; 8] = [0x44, 0x2f, 0x24, 0xef, 0x6b, 0xa5, 0x27, 0xda];
const MIGRATE_PROFILE_DISC: [u8; 8] = [0xe0, 0xbb, 0x84, 0xbd, 0xb9, 0xa3, 0xb7, 0xed];

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    if instruction_data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }

    let (disc, data) = instruction_data.split_at(8);
    let disc: [u8; 8] = disc.try_into().unwrap();

    match disc {
        CREATE_PROFILE_DISC => instructions::create_profile(program_id, accounts, data),
        CREATE_BOT_PROFILE_DISC => instructions::create_bot_profile(program_id, accounts, data),
        CREATE_POST_DISC => instructions::create_post(program_id, accounts, data),
        CREATE_COMPRESSED_POST_DISC => instructions::create_compressed_post(program_id, accounts, data),
        FOLLOW_DISC => instructions::follow(program_id, accounts, data),
        UNFOLLOW_DISC => instructions::unfollow(program_id, accounts, data),
        LIKE_POST_DISC => instructions::like_post(program_id, accounts, data),
        UNLIKE_POST_DISC => instructions::unlike_post(program_id, accounts, data),
        CLOSE_PROFILE_DISC => instructions::close_profile(program_id, accounts, data),
        RECORD_REFERRAL_DISC => instructions::record_referral(program_id, accounts, data),
        UPDATE_PROFILE_DISC => instructions::update_profile(program_id, accounts, data),
        CLAIM_BOT_DISC => instructions::claim_bot(program_id, accounts, data),
        MIGRATE_PROFILE_DISC => instructions::migrate_profile(program_id, accounts, data),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
