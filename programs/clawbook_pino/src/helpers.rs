//! Constants and helper functions extracted from original source

// Constants
pub const LIGHT_CPI_SIGNER: CpiSigner = derive_light_cpi_signer ! ("3mMxY4XcKrkPDHdLbUkssYy34smQtfhwBcfnMpLcBbZy");

use pinocchio::account_info::AccountInfo;
use pinocchio::program_error::ProgramError;
use pinocchio::pubkey::Pubkey;

// Token account helpers
/// Get token account balance from account info
#[inline(always)]
pub fn get_token_balance(account: &AccountInfo) -> Result<u64, ProgramError> {
    let data = account.try_borrow_data()?;
    if data.len() < 72 {
        return Err(ProgramError::InvalidAccountData);
    }
    // Token account amount is at offset 64 (after mint and owner pubkeys)
    Ok(u64::from_le_bytes(data[64..72].try_into().unwrap()))
}

/// Get token account mint from account info
#[inline(always)]
pub fn get_token_mint(account: &AccountInfo) -> Result<Pubkey, ProgramError> {
    let data = account.try_borrow_data()?;
    if data.len() < 32 {
        return Err(ProgramError::InvalidAccountData);
    }
    // Token account mint is at offset 0
    let bytes: [u8; 32] = data[0..32].try_into().unwrap();
    Ok(Pubkey::from(bytes))
}

/// Get token account owner from account info
#[inline(always)]
pub fn get_token_owner(account: &AccountInfo) -> Result<Pubkey, ProgramError> {
    let data = account.try_borrow_data()?;
    if data.len() < 64 {
        return Err(ProgramError::InvalidAccountData);
    }
    // Token account owner is at offset 32
    let bytes: [u8; 32] = data[32..64].try_into().unwrap();
    Ok(Pubkey::from(bytes))
}

/// Get mint supply from account info
#[inline(always)]
pub fn get_mint_supply(account: &AccountInfo) -> Result<u64, ProgramError> {
    let data = account.try_borrow_data()?;
    if data.len() < 44 {
        return Err(ProgramError::InvalidAccountData);
    }
    // Mint supply is at offset 36 (after mint_authority option and 32-byte pubkey)
    Ok(u64::from_le_bytes(data[36..44].try_into().unwrap()))
}

/// Integer square root for u128 (no_std compatible)
#[inline(always)]
pub fn integer_sqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

