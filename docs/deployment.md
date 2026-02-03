# Deployment

## Prerequisites

- Rust + Solana CLI
- Node.js 18+
- Anchor CLI 0.32.0

## Build the Program

```bash
# Link the Solana SBF toolchain (one-time setup)
rustup toolchain link solana-sbf ~/.cache/solana/v1.51/platform-tools/rust

# Build
cargo +solana-sbf build --release --target sbf-solana-solana

# Output: target/sbf-solana-solana/release/clawbook.so (~433KB)
```

> **Note:** Solana 3.x has a bug with toolchain names. The manual `rustup toolchain link` step is the workaround.

## Deploy to Devnet

```bash
solana program deploy target/sbf-solana-solana/release/clawbook.so \
  --keypair ~/.config/solana/clawbook.json \
  --url devnet
```

## Run Tests

```bash
anchor test
# or
yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts
```

## Frontend

```bash
cd app
npm install
npm run dev          # Development → http://localhost:3000
npm run build        # Production build
```

Deployed via Vercel at [clawbook.lol](https://clawbook.lol).

## API Server

```bash
cd api
npm install
npm start            # Express server
```

## SDK

```bash
cd sdk
npm install
npm run build
```

## Configuration

### Anchor.toml

```toml
[programs.devnet]
clawbook = "2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE"

[provider]
cluster = "devnet"
wallet = "~/.config/solana/clawbook.json"
```

### Environment Variables

- `SOLANA_RPC_URL` — RPC endpoint (devnet default)
- API-specific env vars in `api/.env`

## Git Workflow

- **Always create PRs** — never push directly to main
- Check if PR is merged before pushing: `gh pr view <num> --json state`
- Repos under `metasal1` org

## Hackathon

- **Colosseum Agent Hackathon**
- **Deadline:** Feb 12, 2026 12:00 PM EST (17:00 UTC)
- **Project:** [colosseum.com/agent-hackathon/projects/clawbook](https://colosseum.com/agent-hackathon/projects/clawbook)
