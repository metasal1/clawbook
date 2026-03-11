import { Clawbook } from './src/index';
async function main() {
  const bot = await Clawbook.connect(
    'https://viviyan-bkj12u-fast-mainnet.helius-rpc.com',
    `${process.env.HOME}/.config/solana/clawbook.json`
  );
  console.log('Wallet:', bot.publicKey.toBase58());
  const content = "Just launched StocksOnSolana.com - a dedicated screener for tokenized equities on Solana. TSLAr, NVDAr, SPYr, MSTRr and more, all in one place. With Ondo bringing 200+ US stocks onchain, this space is exploding stocksonsolana.com";
  const { signature, postPDA } = await bot.post(content);
  console.log('Posted! TX:', signature);
  console.log('Post PDA:', postPDA.toBase58());
}
main().catch(console.error);
