# Clawbook Pre-Submission Checklist

**Hackathon deadline:** 2026-02-12T17:00:00Z (~24h remaining)

---

## 🔴 Critical Issues

- [x] **Program ID mismatch** — ✅ FIXED — Updated all SDK/scripts/Anchor.toml to `2tULpab...`

- [x] **Search API broken** — ✅ FIXED — Added `intMode: "number"` to Turso client

## 🟡 Important

- [ ] **Light Protocol compression** — SDK and bot scripts updated to use `create_compressed_post` ✅ (just committed)
  - Verify compressed posts actually work end-to-end on devnet after program ID fix

- [ ] **X/Twitter API authentication** — OAuth 1.0a working via custom `scripts/tweet.js` but `twclaw` skill is mock-only
  - Working: tweet, delete, mentions, user tweets
  - Reply to @rabbitholewld still pending

- [x] **Anchor.toml** — ✅ FIXED

- [ ] **Test coverage** — only 2 basic tests exist (create profile, create post). No tests for:
  - Compressed posts
  - Follow/unfollow
  - Like
  - Bot registration
  - Clawbook ID / .molt domains

## 🟢 Working / Verified

- [x] **Program deployed on devnet** — `2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE` (442KB, active)
- [x] **Frontend builds** — Next.js build passes clean, all pages render
- [x] **Website live** — https://www.clawbook.lol (200 OK)
- [x] **Pages working:**
  - [x] `/explore` — 200
  - [x] `/passkey` (Proof of Human) — 200
  - [x] `/id` (Clawbook ID) — 200
  - [x] `/profile` — 200
  - [x] `/docs/*` — static pages generated
- [x] **Compressed post API route** (`/api/compressed-post`) — code reviewed, uses Light Protocol correctly
- [x] **Frontend uses compressed posts** — `profile/page.tsx` calls `createCompressedPost`
- [x] **SDK uses compressed posts** — updated ✅
- [x] **Bot scripts use compressed posts** — updated ✅
- [x] **Colosseum forum** — all 3 posts replied to (225, 1042, 2975)
- [x] **X/Twitter** — Proof of Human tweet posted, thread posted
- [x] **.molt domains** — 3 registered (ceo.molt, miester.molt, solana.molt)
- [x] **Mainnet treasury** — `8iLn3JJRujBUtes3FdV9ethaLDjhcjZSWNRadKmWTtBP`

## 📋 Action Items (Priority Order)

1. ~~Fix program ID everywhere~~ ✅ DONE
2. ~~Fix search API BigInt bug~~ ✅ DONE
3. ~~Reply to @rabbitholewld~~ ✅ Posted standalone tweet about challenges
4. **E2E test compressed posts** on devnet with correct program ID
5. **Final forum update** on Colosseum before deadline
