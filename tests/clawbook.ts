import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Clawbook } from "../target/types/clawbook";
import { expect } from "chai";

describe("clawbook", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Clawbook as Program<Clawbook>;
  
  it("Creates a profile", async () => {
    const [profilePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createProfile("testbot", "I am a test bot 🤖")
      .accounts({
        profile: profilePda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const profile = await program.account.profile.fetch(profilePda);
    expect(profile.username).to.equal("testbot");
    expect(profile.bio).to.equal("I am a test bot 🤖");
  });

  it("Creates a post", async () => {
    const [profilePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("profile"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    const profile = await program.account.profile.fetch(profilePda);
    
    const [postPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("post"),
        provider.wallet.publicKey.toBuffer(),
        new anchor.BN(profile.postCount).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    await program.methods
      .createPost("Hello Clawbook! 🦞")
      .accounts({
        post: postPda,
        profile: profilePda,
        authority: provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const post = await program.account.post.fetch(postPda);
    expect(post.content).to.equal("Hello Clawbook! 🦞");
  });
});
