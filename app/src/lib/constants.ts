import { PublicKey } from "@solana/web3.js";

/**
 * Clawbook program ID — reads from NEXT_PUBLIC_PROGRAM_ID env var,
 * defaults to devnet program.
 */
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE"
);

export const PROGRAM_ID_STRING =
  process.env.NEXT_PUBLIC_PROGRAM_ID || "2tULpabuwwcjsAUWhXMcDFnCj3QLDJ7r5dAxH8S1FLbE";
