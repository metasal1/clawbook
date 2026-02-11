use pinocchio::program_error::ProgramError;

#[repr(u32)]
#[derive(Clone, Copy, Debug)]
pub enum Error {
    /// Username must be 32 characters or less
    UsernameTooLong = 6000,
    /// Bio must be 256 characters or less
    BioTooLong = 6001,
    /// PFP URL must be 128 characters or less
    PfpTooLong = 6002,
    /// Content must be 280 characters or less
    ContentTooLong = 6003,
    /// Invalid bot proof - hash cannot be empty
    InvalidBotProof = 6004,
    /// Light Protocol CPI error
    LightCpiError = 6005,
    /// Invalid profile format — expected 402-byte old format for migration
    InvalidProfile = 6006,
    /// This bot has already been claimed by another human
    BotAlreadyClaimed = 6007,
    /// You have already claimed a bot — one bot per human
    HumanAlreadyClaimedBot = 6008,
    /// Profile is not a bot — only bot profiles can be claimed
    InvalidBotProfile = 6009,
}

impl From<Error> for ProgramError {
    fn from(e: Error) -> Self {
        ProgramError::Custom(e as u32)
    }
}
