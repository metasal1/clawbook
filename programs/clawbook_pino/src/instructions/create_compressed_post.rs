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

pub fn create_compressed_post(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    // No accounts required
    Ok(())
}
