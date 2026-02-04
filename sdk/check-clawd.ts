import { Connection, PublicKey } from "@solana/web3.js";

async function main() {
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const PROGRAM_ID = new PublicKey("2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE");
  const clawd = new PublicKey("cLaw2M5vpjdLzeAMeZsvdbzNxDTt1K9A49GQXbTD9vt");
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), clawd.toBuffer()],
    PROGRAM_ID
  );
  const info = await conn.getAccountInfo(pda);
  if (!info) { console.log("Not found"); return; }
  
  console.log("Size:", info.data.length);
  let off = 8 + 32;
  const uLen = info.data.readUInt32LE(off); off += 4;
  console.log("Username:", info.data.subarray(off, off + uLen).toString());
  off += uLen;
  const bioLen = info.data.readUInt32LE(off); off += 4;
  console.log("Bio:", info.data.subarray(off, off + bioLen).toString().slice(0, 80));
  off += bioLen;
  
  if (info.data.length >= 534) {
    const pfpLen = info.data.readUInt32LE(off); off += 4;
    console.log("PFP len:", pfpLen);
    console.log("PFP:", info.data.subarray(off, off + pfpLen).toString().slice(0, 80));
    off += pfpLen;
  }
  
  console.log("account_type:", info.data[off]); off += 1;
  console.log("proof_hash (first 4):", info.data.subarray(off, off + 4).toString("hex")); off += 32;
  console.log("verified:", info.data[off]); off += 1;
  console.log("post_count:", Number(info.data.readBigUInt64LE(off))); off += 8;
  console.log("follower_count:", Number(info.data.readBigUInt64LE(off))); off += 8;
  console.log("following_count:", Number(info.data.readBigUInt64LE(off)));
}

main();
