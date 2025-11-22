import { ethers } from "hardhat";

/**
 * Deploy ERC20FeeSplitter - Fully immutable, no owner, no configuration changes
 *
 * IMPORTANT: Configuration is PERMANENT and CANNOT be changed after deployment!
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ERC20FeeSplitter with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );

  // PRODUCTION CONFIGURATION (PERMANENT - CANNOT BE CHANGED!)
  const NICK = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
  const IGNAS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
  const SHARES = [1, 1]; // 50/50 split

  console.log("\n=== PERMANENT Configuration ===");
  console.log("WARNING: This configuration is IMMUTABLE and PERMANENT!");
  console.log("Nick:  ", NICK, "(50%)");
  console.log("Ignas: ", IGNAS, "(50%)");
  console.log("Shares:", SHARES);

  // Deploy
  const FeeSplitter = await ethers.getContractFactory("ERC20FeeSplitter");

  console.log("\nDeploying immutable contract...");
  const splitter = await FeeSplitter.deploy(NICK, IGNAS, SHARES[0], SHARES[1]);
  await splitter.waitForDeployment();

  const contractAddress = await splitter.getAddress();

  console.log("\n=== Deployment Successful ===");
  console.log("Contract address:", contractAddress);

  // Verify configuration
  console.log("\n=== Configuration Verification ===");
  console.log("Payee 1:", await splitter.PAYEE1());
  console.log("Payee 2:", await splitter.PAYEE2());
  console.log("Total shares:", await splitter.TOTAL_SHARES());
  console.log("Nick's shares:", await splitter.SHARES1());
  console.log("Ignas's shares:", await splitter.SHARES2());

  console.log("\n=== IMPORTANT ===");
  console.log("This contract is FULLY IMMUTABLE:");
  console.log("- NO owner (no one can change anything)");
  console.log("- NO ability to change payees");
  console.log("- NO ability to change fee percentages");
  console.log("- Configuration is PERMANENT");
  console.log("");
  console.log("If you need to change the split, you must:");
  console.log("1. Deploy a NEW contract");
  console.log("2. Update your fee recipients to point to the new contract");

  console.log("\n=== Next Steps ===");
  console.log("1. Verify contract on Basescan:");
  console.log(`   npx hardhat verify --network base ${contractAddress} \\`);
  console.log(`     "${NICK}" \\`);
  console.log(`     "${IGNAS}" \\`);
  console.log(`     "${SHARES[0]}" \\`);
  console.log(`     "${SHARES[1]}"`);
  console.log("");
  console.log("2. Set as fee recipient in your Morpho vaults");
  console.log("3. Start receiving and splitting fees!");

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contract: contractAddress,
    payee1: NICK,
    payee2: IGNAS,
    shares: SHARES,
    immutable: true,
    noOwner: true,
  };

  console.log("\n=== Deployment Info (SAVE THIS) ===");
  console.log(
    JSON.stringify(
      deploymentInfo,
      (key, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
