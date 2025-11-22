import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

async function main() {
  const contractAddress = "0x3690Eb8735fE51c695d2f2Da289D1FA447137E24";
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    contractAddress,
  )) as ERC20FeeSplitterV2;

  console.log("Checking contract state...\n");

  try {
    const ownerCount = await splitter.getOwnerCount();
    console.log("Owner count:", ownerCount.toString());

    const allOwners = await splitter.getAllOwners();
    console.log("All owners:", allOwners);

    const totalShares = await splitter.totalShares();
    console.log("Total shares:", totalShares.toString());

    const payeeCount = await splitter.getPayeeCount();
    console.log("Payee count:", payeeCount.toString());

    const allPayees = await splitter.getAllPayees();
    console.log("All payees:", allPayees);

    // Check if specific addresses are owners
    const nick = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
    const ignas = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
    console.log("\nOwner checks:");
    console.log("Nick is owner:", await splitter.isOwner(nick));
    console.log("Ignas is owner:", await splitter.isOwner(ignas));

    // Check payee info
    console.log("\nPayee info:");
    for (const payee of allPayees) {
      const info = await splitter.getPayeeInfo(payee);
      console.log(`${payee}: ${info.shares.toString()} shares, exists: ${info.exists}`);
    }
  } catch (error: any) {
    console.error("Error checking contract:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

