import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

/**
 * Manage payees in ERC20FeeSplitterV2 (Owner Only)
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... ACTION=add PAYEE=0x... SHARES=2 npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/managePayees.ts --network base
 *   CONTRACT_ADDRESS=0x... ACTION=remove PAYEE=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/managePayees.ts --network base
 *   CONTRACT_ADDRESS=0x... ACTION=update PAYEE=0x... SHARES=5 npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/managePayees.ts --network base
 */
async function main() {
  const [signer] = await ethers.getSigners();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const ACTION = process.env.ACTION?.toLowerCase(); // add, remove, or update
  const PAYEE = process.env.PAYEE;
  const SHARES = process.env.SHARES;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }
  if (!ACTION || !["add", "remove", "update"].includes(ACTION)) {
    throw new Error("Please set ACTION to 'add', 'remove', or 'update'");
  }
  if (!PAYEE) {
    throw new Error("Please set PAYEE address in .env file or environment variable");
  }
  if ((ACTION === "add" || ACTION === "update") && !SHARES) {
    throw new Error(
      "Please set SHARES in .env file or environment variable for add/update actions",
    );
  }

  console.log("Managing payees with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Action:", ACTION);
  console.log("Payee:", PAYEE);

  // Get contract instance
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  // Verify caller is owner
  const isOwner = await splitter.isOwner(signer.address);
  if (!isOwner) {
    const allOwners = await splitter.getAllOwners();
    throw new Error(`Only owners can manage payees. Owners: ${allOwners.join(", ")}, Caller: ${signer.address}`);
  }

  // Get current state
  const totalSharesBefore = await splitter.totalShares();
  const payeeCountBefore = await splitter.getPayeeCount();
  const allPayeesBefore = await splitter.getAllPayees();

  console.log("\n=== Current State ===");
  console.log("Total shares:", totalSharesBefore.toString());
  console.log("Payee count:", payeeCountBefore.toString());
  console.log("Payees:");
  for (let i = 0; i < allPayeesBefore.length; i++) {
    const info = await splitter.getPayeeInfo(allPayeesBefore[i]);
    console.log(`  ${i + 1}. ${allPayeesBefore[i]} - ${info.shares} shares`);
  }

  let tx;
  let receipt;

  if (ACTION === "add") {
    const shares = BigInt(SHARES!);
    console.log("\n=== Adding Payee ===");
    console.log("Payee:", PAYEE);
    console.log("Shares:", shares.toString());

    // Check if payee already exists
    const existingInfo = await splitter.getPayeeInfo(PAYEE);
    if (existingInfo.exists) {
      throw new Error(`Payee ${PAYEE} already exists with ${existingInfo.shares} shares`);
    }

    tx = await splitter.addPayee(PAYEE, shares);
    console.log("Transaction hash:", tx.hash);

    console.log("Waiting for confirmation...");
    receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
  } else if (ACTION === "remove") {
    console.log("\n=== Removing Payee ===");
    console.log("Payee:", PAYEE);

    // Check if payee exists
    const existingInfo = await splitter.getPayeeInfo(PAYEE);
    if (!existingInfo.exists) {
      throw new Error(`Payee ${PAYEE} does not exist`);
    }
    console.log("Current shares:", existingInfo.shares.toString());

    tx = await splitter.removePayee(PAYEE);
    console.log("Transaction hash:", tx.hash);

    console.log("Waiting for confirmation...");
    receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
  } else if (ACTION === "update") {
    const newShares = BigInt(SHARES!);
    console.log("\n=== Updating Payee Shares ===");
    console.log("Payee:", PAYEE);

    // Check if payee exists
    const existingInfo = await splitter.getPayeeInfo(PAYEE);
    if (!existingInfo.exists) {
      throw new Error(`Payee ${PAYEE} does not exist`);
    }
    console.log("Old shares:", existingInfo.shares.toString());
    console.log("New shares:", newShares.toString());

    tx = await splitter.updatePayeeShares(PAYEE, newShares);
    console.log("Transaction hash:", tx.hash);

    console.log("Waiting for confirmation...");
    receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);
  }

  // Get updated state
  const totalSharesAfter = await splitter.totalShares();
  const payeeCountAfter = await splitter.getPayeeCount();
  const allPayeesAfter = await splitter.getAllPayees();

  console.log("\n=== Updated State ===");
  console.log("Total shares:", totalSharesAfter.toString());
  console.log("Payee count:", payeeCountAfter.toString());
  console.log("Payees:");
  for (let i = 0; i < allPayeesAfter.length; i++) {
    const info = await splitter.getPayeeInfo(allPayeesAfter[i]);
    console.log(
      "  " + (i + 1) + ". " + allPayeesAfter[i] + " - " + info.shares.toString() + " shares",
    );
  }

  console.log("\n✅ Payee management complete!");
}

// Only execute if run directly (not during tests)
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
