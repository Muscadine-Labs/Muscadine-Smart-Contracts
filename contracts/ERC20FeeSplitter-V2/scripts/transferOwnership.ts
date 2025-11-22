import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

/**
 * Add or remove owner from ERC20FeeSplitterV2 (Owner Only)
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... ACTION=add OWNER_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/transferOwnership.ts --network base
 *   CONTRACT_ADDRESS=0x... ACTION=remove OWNER_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/transferOwnership.ts --network base
 */
async function main() {
  const [signer] = await ethers.getSigners();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const ACTION = process.env.ACTION || "add"; // "add" or "remove"
  const OWNER_ADDRESS = process.env.OWNER_ADDRESS || process.env.NEW_OWNER;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }
  if (!OWNER_ADDRESS) {
    throw new Error("Please set OWNER_ADDRESS in .env file or environment variable");
  }

  console.log("Managing owners with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Action:", ACTION);
  console.log("Owner address:", OWNER_ADDRESS);

  // Get contract instance
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  // Verify caller is owner
  const isOwner = await splitter.isOwner(signer.address);
  if (!isOwner) {
    const allOwners = await splitter.getAllOwners();
    throw new Error(
      `Only owners can manage owners. Current owners: ${allOwners.join(", ")}, Caller: ${signer.address}`,
    );
  }

  // Get current owners
  const allOwnersBefore = await splitter.getAllOwners();
  const ownerCountBefore = await splitter.getOwnerCount();

  console.log("\n=== Current State ===");
  console.log("Current owners:", allOwnersBefore);
  console.log("Owner count:", ownerCountBefore.toString());

  if (ACTION === "add") {
    // Check if already owner
    const alreadyOwner = await splitter.isOwner(OWNER_ADDRESS);
    if (alreadyOwner) {
      throw new Error("Address is already an owner");
    }

    console.log("\n=== Adding Owner ===");
    console.log("Adding:", OWNER_ADDRESS);

    const tx = await splitter.addOwner(OWNER_ADDRESS);
    console.log("Transaction hash:", tx.hash);

    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

    // Verify
    const isNowOwner = await splitter.isOwner(OWNER_ADDRESS);
    const allOwnersAfter = await splitter.getAllOwners();
    console.log("\n=== Verification ===");
    console.log("Is owner:", isNowOwner);
    console.log("All owners:", allOwnersAfter);

    if (isNowOwner) {
      console.log("✅ Owner added successfully!");
    } else {
      console.log("⚠️  Warning: Owner was not added!");
    }
  } else if (ACTION === "remove") {
    // Check if is owner
    const isOwnerToRemove = await splitter.isOwner(OWNER_ADDRESS);
    if (!isOwnerToRemove) {
      throw new Error("Address is not an owner");
    }

    // Check if trying to remove self and is last owner
    if (signer.address.toLowerCase() === OWNER_ADDRESS.toLowerCase() && ownerCountBefore === 1n) {
      throw new Error("Cannot remove the last owner");
    }

    console.log("\n=== Removing Owner ===");
    console.log("Removing:", OWNER_ADDRESS);

    const tx = await splitter.removeOwner(OWNER_ADDRESS);
    console.log("Transaction hash:", tx.hash);

    console.log("Waiting for confirmation...");
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

    // Verify
    const isStillOwner = await splitter.isOwner(OWNER_ADDRESS);
    const allOwnersAfter = await splitter.getAllOwners();
    console.log("\n=== Verification ===");
    console.log("Is still owner:", isStillOwner);
    console.log("All owners:", allOwnersAfter);

    if (!isStillOwner) {
      console.log("✅ Owner removed successfully!");
    } else {
      console.log("⚠️  Warning: Owner was not removed!");
    }
  } else {
    throw new Error(`Invalid ACTION. Must be "add" or "remove", got: ${ACTION}`);
  }

  console.log("\n⚠️  IMPORTANT: Owners have full control:");
  console.log("  - Can add/remove/update payees");
  console.log("  - Can add/remove other owners");
  console.log("  - For production, use multiple owners for better security");
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
