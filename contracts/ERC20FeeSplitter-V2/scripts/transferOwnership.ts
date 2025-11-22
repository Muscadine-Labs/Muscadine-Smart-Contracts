import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

/**
 * Transfer ownership of ERC20FeeSplitterV2 (Owner Only)
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... NEW_OWNER=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/transferOwnership.ts --network base
 */
async function main() {
  const [signer] = await ethers.getSigners();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const NEW_OWNER = process.env.NEW_OWNER;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }
  if (!NEW_OWNER) {
    throw new Error("Please set NEW_OWNER address in .env file or environment variable");
  }

  console.log("Transferring ownership with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("New owner:", NEW_OWNER);

  // Get contract instance
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  // Verify caller is owner
  const currentOwner = await splitter.owner();
  if (signer.address.toLowerCase() !== currentOwner.toLowerCase()) {
    throw new Error(
      `Only owner can transfer ownership. Current owner: ${currentOwner}, Caller: ${signer.address}`,
    );
  }

  // Check if new owner is different
  if (currentOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
    throw new Error("New owner address is the same as current owner");
  }

  console.log("\n=== Ownership Transfer ===");
  console.log("Current owner:", currentOwner);
  console.log("New owner:", NEW_OWNER);

  // Transfer ownership
  console.log("\nTransferring ownership...");
  const tx = await splitter.transferOwnership(NEW_OWNER);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

  // Verify new owner
  const newOwner = await splitter.owner();
  console.log("\n=== Verification ===");
  console.log("New owner:", newOwner);

  if (newOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
    console.log("✅ Ownership transfer successful!");
  } else {
    console.log("⚠️  Warning: Owner address mismatch!");
  }

  console.log("\n⚠️  IMPORTANT: The new owner now has full control:");
  console.log("  - Can upgrade the contract");
  console.log("  - Can add/remove/update payees");
  console.log("  - Can transfer ownership again");
  console.log("  - For production, use a MULTI-SIG WALLET as owner");
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
