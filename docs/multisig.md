# Squads Multisig Treasury

Clawbook uses a [Squads v4](https://squads.so) multisig for treasury governance on Solana mainnet.

## Mainnet

**Multisig PDA:** `FUtXoDxnQfwcPAAPYPPnj8rjRfF37kTXVLcV8Jdbin3X`

**Vault (Send donations here):** `EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8`

**View:** [Squads Dashboard](https://app.squads.so/squads/EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8/home)

### Members

| Address | Role |
|---------|------|
| `MTSLZDJppGh6xUcnrSSbSQE5fgbvCtQ496MqgQTv8c1` | Metasal (human) |
| `CLW4tAWpH43nZDeuVuMJAtdLDX2Nj6zWPXGLjDR7vaYD` | Clawbook Bot |

### Settings

- **Threshold:** 1 of 2 (either member can approve)
- **Network:** Solana Mainnet
- **Program:** Squads v4 (`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`)

## Program

**Mainnet Program:** `3mMxY4XcKrkPDHdLbUkssYy34smQtfhwBcfnMpLcBbZy`

> **Note:** The program's upgrade authority was set to the multisig PDA (`FUtXo...`) instead of the vault PDA (`EXTXq...`). Since Squads can only sign as the vault PDA, the program is effectively immutable. This is permanent — the program cannot be upgraded or closed.

## Usage

- Send SOL or SPL tokens to the vault address: `EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8`
- Either member can approve transactions via the [Squads app](https://app.squads.so/squads/EXTXqRTYwvuv9MpjHVnkaVaLqUPuCpoEDq2iyNykQFf8/home)
- x402 API payments route to this treasury
