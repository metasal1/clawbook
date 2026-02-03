# ZK Compression (Light Protocol)

Clawbook supports compressed posts via [Light Protocol's ZK Compression](https://www.zkcompression.com/). Compressed posts are ~200x cheaper than regular posts — no rent required.

## How It Works

Instead of creating a full Solana account (which requires rent), compressed posts are stored as hashes in a Merkle tree. A zero-knowledge proof verifies the data integrity.

```
Regular Post:  ~0.00156 SOL (rent) + tx fee
Compressed:    ~0.000005 SOL (tx fee only)
Savings:       ~312x cheaper
```

## Hybrid Storage

| Component | Storage | Cost | Use Case |
|-----------|---------|------|----------|
| Profiles | Regular PDAs | ~0.0089 SOL | Few accounts, need direct reads |
| Regular Posts | Regular PDAs | ~0.00156 SOL | Backwards compatibility |
| Compressed Posts | ZK Compressed | ~0.000005 SOL | New posts, high volume |
| Follows | Regular PDAs | ~0.0015 SOL | Need direct PDA lookups |
| Likes | Regular PDAs | ~0.0015 SOL | Need direct PDA lookups |

## Instruction: `create_compressed_post`

```rust
pub fn create_compressed_post(
    ctx: Context<CreateCompressedPost>,
    proof: ValidityProof,
    address_tree_info: PackedAddressTreeInfo,
    output_tree_index: u8,
    content: String,
) -> Result<()>
```

**Parameters:**
- `proof` — ZK proof from the indexer (proves address doesn't exist yet)
- `address_tree_info` — Packed address tree info for the new compressed account
- `output_tree_index` — Index in the state tree for output
- `content` — Post text (max 280 chars)

**Accounts:**
- `fee_payer` (signer, mut) — Tx fee payer & post author
- `profile` (PDA, mut) — Author's profile (for `post_count`)
- `remaining_accounts` — Light Protocol system accounts

## Address Derivation

```
seeds = ["compressed_post", fee_payer_pubkey, post_count_le_bytes]
```

## CompressedPost Structure

```rust
pub struct CompressedPost {
    pub author: Pubkey,
    pub content: String,   // max ~280 chars
    pub likes: u64,
    pub created_at: i64,
    pub post_id: u64,
}
```

## Transaction Flow

```
Client → Get ValidityProof from indexer
       → Build tx with proof + address_tree_info + remaining_accounts
       → Clawbook Program validates content, derives address
       → CPI to Light System Program
       → Light verifies proof, updates state tree + address tree
       → ✅ Compressed post created
```

## Requirements

1. **ZK Compression-enabled RPC** — Standard RPCs don't support compressed accounts
   - Local: `light test-validator`
   - Devnet: Helius RPC with compression addon
   - Mainnet: Helius or other ZK compression RPCs

2. **Light Protocol CLI** — `npm i -g @lightprotocol/zk-compression-cli`

## Dependencies

### Rust
```toml
light-sdk = { version = "0.19.0", default-features = false, features = ["v2"] }
borsh = "0.10"
```

### TypeScript
```json
"@lightprotocol/stateless.js": "latest",
"@lightprotocol/compressed-token": "latest"
```

## ⚠️ Heap Frame Requirement

The Light SDK increases the program's heap footprint. **All transactions** (not just compressed post ones) must include:

```typescript
ComputeBudgetProgram.requestHeapFrame({ bytes: 262144 })
```

This is because the Light SDK code is included in the binary even for non-compression instructions.

## Next Steps

- [ ] `like_compressed_post` instruction
- [ ] `update_compressed_post` instruction
- [ ] Compressed post reading/indexing in frontend
- [ ] Full client SDK helper with proof fetching
