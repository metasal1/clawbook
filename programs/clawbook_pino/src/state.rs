use pinocchio::{account_info::AccountInfo, program_error::ProgramError};

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Profile {
    pub authority: [u8; 32],
    pub username: String,
    pub bio: String,
    pub pfp: String,
    pub account_type: AccountType,
    pub bot_proof_hash: [u8 ; 32],
    pub verified: bool,
    pub post_count: u64,
    pub follower_count: u64,
    pub following_count: u64,
    pub created_at: i64,
}

impl Profile {
    pub const SIZE: usize = 149;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Post {
    pub author: [u8; 32],
    pub content: String,
    pub likes: u64,
    pub created_at: i64,
    pub post_id: u64,
}

impl Post {
    pub const SIZE: usize = 68;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct FollowAccount {
    pub follower: [u8; 32],
    pub following: [u8; 32],
    pub created_at: i64,
}

impl FollowAccount {
    pub const SIZE: usize = 80;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Like {
    pub user: [u8; 32],
    pub post: [u8; 32],
    pub created_at: i64,
}

impl Like {
    pub const SIZE: usize = 80;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct Referral {
    pub referred: [u8; 32],
    pub referrer: [u8; 32],
    pub created_at: i64,
}

impl Referral {
    pub const SIZE: usize = 80;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct ReferrerStats {
    pub authority: [u8; 32],
    pub referral_count: u64,
}

impl ReferrerStats {
    pub const SIZE: usize = 48;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct BotClaim {
    pub owner: [u8; 32],
    pub bot: [u8; 32],
    pub claimed_at: i64,
}

impl BotClaim {
    pub const SIZE: usize = 80;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct HumanClaim {
    pub owner: [u8; 32],
    pub bot: [u8; 32],
    pub claimed_at: i64,
}

impl HumanClaim {
    pub const SIZE: usize = 80;

    #[inline(always)]
    pub fn from_account_info(info: &AccountInfo) -> Result<&Self, ProgramError> {
        let data = info.try_borrow_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        // Skip 8-byte discriminator
        Ok(unsafe { &*(data[8..].as_ptr() as *const Self) })
    }

    #[inline(always)]
    pub fn from_account_info_mut(info: &AccountInfo) -> Result<&mut Self, ProgramError> {
        let mut data = info.try_borrow_mut_data()?;
        if data.len() < 8 + Self::SIZE {
            return Err(ProgramError::InvalidAccountData);
        }
        Ok(unsafe { &mut *(data[8..].as_mut_ptr() as *mut Self) })
    }
}

