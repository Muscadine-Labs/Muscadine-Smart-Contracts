import { ethers } from "hardhat";

/**
 * This script is no longer used - upgrade functionality has been removed from ERC20FeeSplitterV2
 * 
 * The contract is now immutable and cannot be upgraded.
 * 
 * If you need to make changes, you must deploy a new contract.
 */

async function main() {
  console.log("⚠️  Upgrade functionality has been removed from ERC20FeeSplitterV2");
  console.log("The contract is now immutable and cannot be upgraded.");
  console.log("If you need to make changes, you must deploy a new contract.");
  process.exit(0);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
