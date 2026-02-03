/**
 * Count all .molt domains registered on Solana using AllDomains SDK
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAllTld, findAllDomainsForTld, NameRecordHeader, TldParser } from "@onsol/tldparser";

const RPC_URL = "https://viviyan-bkj12u-fast-mainnet.helius-rpc.com";

async function countMoltDomains() {
  const connection = new Connection(RPC_URL);
  const parser = new TldParser(connection);
  
  console.log("Fetching all TLDs...");
  const allTlds = await getAllTld(connection);
  
  // Find .molt TLD
  const moltTld = allTlds.find(tld => tld.tld === ".molt");
  
  if (!moltTld) {
    console.log("Available TLDs:");
    allTlds.forEach(tld => console.log(`  ${tld.tld}`));
    console.error(".molt TLD not found!");
    return;
  }
  
  console.log(`Found .molt TLD: ${moltTld.parentAccount.toBase58()}`);
  
  // Get all domains in .molt TLD
  console.log("Counting .molt domains...");
  const allMoltDomains = await findAllDomainsForTld(connection, moltTld.parentAccount);
  
  console.log(`\n✅ Total .molt domains registered: ${allMoltDomains.length}`);
  
  // Show first 10 domains as sample
  if (allMoltDomains.length > 0) {
    console.log("\nSample domains (first 10):");
    const parentNameRecord = await NameRecordHeader.fromAccountAddress(connection, moltTld.parentAccount);
    
    if (parentNameRecord && parentNameRecord.owner) {
      for (let i = 0; i < Math.min(10, allMoltDomains.length); i++) {
        try {
          const domain = await parser.reverseLookupNameAccount(allMoltDomains[i], parentNameRecord.owner);
          console.log(`  ${domain}.molt`);
        } catch (e) {
          console.log(`  [${allMoltDomains[i].toBase58()}]`);
        }
      }
    }
  }
  
  return allMoltDomains.length;
}

countMoltDomains().catch(console.error);
