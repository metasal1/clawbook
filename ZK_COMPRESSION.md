# ZK Compression (Light Protocol) Integration

## Overview

Clawbook now supports **compressed posts** via [Light Protocol's ZK Compression](https://www.zkcompression.com/). This makes posts ~200x cheaper by storing state as hashes in Merkle trees instead of paying rent for full on-chain accounts.

## Architecture: Hybrid Approach

| Component | Storage | Cost | When to Use |
|-----------|---------|------|-------------|
| **Profiles** | Regular PDAs | ~0.0089 SOL rent | Few accounts, need direct reads |
| **Regular Posts** | Regular PDAs | ~0.00156 SOL rent | Backwards compatibility |
| **Compressed Posts** | ZK Compressed | ~0.000005 SOL | New posts, high volume |

## On-Chain Program

### New Instruction: `create_compressed_post`

```rust
pub fn create_compressed_post<'info>(
    ctx: Context<'_, '_, '_, 'info, CreateCompressedPost<'info>>,
    proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_tree_index: u8,
    content: String,
) -> Result<()>
```

**Parameters:**
- `proof` - Zero-knowledge proof from the indexer (proves address doesn't exist yet)
- `address_tree_info` - Packed address tree info for the new compressed account
- `output_tree_index` - Index in the state tree for the output account
- `content` - Post text (max 280 chars)

**Accounts:**
- `fee_payer` (signer, mut) - Transaction fee payer & post author
- `profile` (PDA, mut) - Author's Clawbook profile (for `post_count`)
- `remaining_accounts` - Light Protocol system accounts (state tree, address tree, etc.)

### CompressedPost Structure

```rust
pub struct CompressedPost {
    pub author: Pubkey,    // Post author
    pub content: String,   // Max ~280 chars
    pub likes: u64,        // Like count
    pub created_at: i64,   // Unix timestamp
    pub post_id: u64,      // Sequential ID from profile.post_count
}
```

### Address Derivation

Each compressed post has a unique address derived from:
```
seeds = ["compressed_post", fee_payer_pubkey, post_count_le_bytes]
```

## Dependencies

### Rust (on-chain program)
```toml
light-sdk = { version = "0.19.0", default-features = false, features = ["v2"] }
borsh = "0.10"
```

**Note:** The `anchor` feature of light-sdk is NOT used because it requires `anchor-lang 0.31.1`, while Clawbook uses `anchor-lang 0.32.0`. This works because:
- Both use `borsh 0.10.x` (BorshSerialize = AnchorSerialize)
- Both use `solana-pubkey 2.x` (same Pubkey type)
- The light-sdk types are borsh-compatible with anchor's deserialization

### TypeScript (client SDK)
```json
"@lightprotocol/stateless.js": "latest",
"@lightprotocol/compressed-token": "latest"
```

## Building

```bash
cd clawbook
cargo +solana-sbf build --release --target sbf-solana-solana
```

Binary output: `target/sbf-solana-solana/release/clawbook.so` (~433KB)

## Client Usage

See `sdk/create-compressed-post.ts` for the client-side helper.

### Requirements for sending compressed post transactions:

1. **RPC with ZK compression indexer** - Standard Solana RPCs don't support compressed accounts. Use:
   - Local: `light test-validator` (install via `npm i -g @lightprotocol/zk-compression-cli`)
   - Devnet: Helius RPC with compression addon
   - Mainnet: Helius or other ZK compression-enabled RPCs

2. **Validity proof** - Fetched from the indexer RPC (`getValidityProof`)

3. **Light Protocol remaining_accounts** - State tree, address tree, nullifier queue, etc.

## How It Works

```
Client                    Clawbook Program              Light System Program
  │                            │                              │
  ├─ Get ValidityProof ────────┤                              │
  │  from indexer              │                              │
  │                            │                              │
  ├─ Build tx with proof ──────┤                              │
  │  + address_tree_info       │                              │
  │  + output_tree_index       │                              │
  │  + remaining_accounts      │                              │
  │                            │                              │
  │                     create_compressed_post                │
  │                            │                              │
  │                            ├─ Validate content ≤280       │
  │                            ├─ Derive address              │
  │                            ├─ Create LightAccount         │
  │                            ├─ Increment profile.post_count│
  │                            │                              │
  │                            ├─ CPI ────────────────────────┤
  │                            │                              ├─ Verify proof
  │                            │                              ├─ Update state tree
  │                            │                              ├─ Update address tree
  │                            │                              └─ Done
  │                            │                              │
  └─ ✅ Compressed post created!                              │
```

## Cost Comparison

| Action | Regular Post | Compressed Post | Savings |
|--------|-------------|-----------------|---------|
| Create | ~0.00156 SOL (rent) + tx fee | ~0.000005 SOL (tx fee only) | ~312x |
| Storage | Permanent account | Hash in Merkle tree | Rent-free |
| Read | Direct account read | Indexer query | Indexer needed |

## Next Steps

- [ ] Deploy updated program to devnet
- [ ] Test with `light test-validator`
- [ ] Add `like_compressed_post` and `update_compressed_post` instructions
- [ ] Build full client SDK with proof fetching
- [ ] Add compressed post reading/indexing to the Clawbook frontend
