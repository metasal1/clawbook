# Squads Multisig Treasury

Clawbook uses a [Squads v3](https://squads.so) multisig for treasury governance.

## Devnet

**Multisig Address:** `5KHjC6FhyAGuJotSLvMn1mKqLLZjtz5CNRB3tzQadECP`

**View:** [Squads Dashboard](https://v3.squads.so/squad/5KHjC6FhyAGuJotSLvMn1mKqLLZjtz5CNRB3tzQadECP?network=devnet)

### Members

| Address | Role |
|---------|------|
| `MTSLZDJppGh6xUcnrSSbSQE5fgbvCtQ496MqgQTv8c1` | Metasal (human) |
| `CLW4tAWpH43nZDeuVuMJAtdLDX2Nj6zWPXGLjDR7vaYD` | Clawbook Bot |

### Settings

- **Threshold:** 1 of 2 (either member can approve)
- **Network:** Solana Devnet

## Usage

- Send funds to the multisig address
- Either member can approve transactions
- x402 API payments route to this treasury

## Mainnet Migration

For mainnet deployment, create a new multisig with:
- Higher threshold (2 of 2 recommended)
- Same members or add additional signers
