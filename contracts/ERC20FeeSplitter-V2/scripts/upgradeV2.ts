import { ethers, upgrades } from "hardhat";

/**
 * Upgrade ERC20FeeSplitterV2 to a new implementation
 *
 * Usage:
 *   npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base
 *
 * Make sure to set PROXY_ADDRESS in .env or update it in this script
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Upgrading ERC20FeeSplitterV2 with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );

  // Get the proxy address from environment or set it here
  const PROXY_ADDRESS = process.env.PROXY_ADDRESS || "0x0000000000000000000000000000000000000000";

  // Skip if running in test environment (hardhat test) - scripts shouldn't run during tests
  // Check if we're in a test context by looking for test files being executed
  const isTestEnvironment =
    process.argv.some((arg) => arg.includes("test")) ||
    process.env.HARDHAT_NETWORK === "hardhat" ||
    !PROXY_ADDRESS ||
    PROXY_ADDRESS === "0x0000000000000000000000000000000000000000";

  if (isTestEnvironment && PROXY_ADDRESS === "0x0000000000000000000000000000000000000000") {
    // Silently exit in test environment - this script shouldn't run during tests
    return;
  }

  if (PROXY_ADDRESS === "0x0000000000000000000000000000000000000000") {
    throw new Error("Please set PROXY_ADDRESS in .env file or update this script");
  }

  console.log("\n=== Upgrade Information ===");
  console.log("Proxy address:", PROXY_ADDRESS);

  // Get current implementation address
  const currentImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);
  console.log("Current implementation:", currentImplementation);

  // Deploy new implementation
  console.log("\nDeploying new implementation...");
  const ERC20FeeSplitterV2Factory = await ethers.getContractFactory("ERC20FeeSplitterV2");

  const upgraded = await upgrades.upgradeProxy(PROXY_ADDRESS, ERC20FeeSplitterV2Factory);
  await upgraded.waitForDeployment();

  const newImplementation = await upgrades.erc1967.getImplementationAddress(PROXY_ADDRESS);

  console.log("\n=== Upgrade Successful ===");
  console.log("Proxy address (unchanged):", PROXY_ADDRESS);
  console.log("New implementation:", newImplementation);
  console.log("Previous implementation:", currentImplementation);

  // Verify the upgrade worked
  console.log("\n=== Verification ===");
  const contract = await ethers.getContractAt("ERC20FeeSplitterV2", PROXY_ADDRESS);
  console.log("Owner:", await contract.owner());
  console.log("Total shares:", await contract.totalShares());
  console.log("Payee count:", await contract.getPayeeCount());

  console.log("\n=== Next Steps ===");
  console.log("1. Verify new implementation contract on Basescan:");
  console.log(`   npx hardhat verify --network base ${newImplementation}`);
  console.log("");
  console.log("2. Test the upgraded contract to ensure all functions work correctly");
  console.log("");
  console.log("3. Monitor contract activity after upgrade");

  // Save upgrade info
  const upgradeInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    proxy: PROXY_ADDRESS,
    previousImplementation: currentImplementation,
    newImplementation: newImplementation,
    upgradePattern: "UUPS",
  };

  console.log("\n=== Upgrade Info (SAVE THIS) ===");
  console.log(
    JSON.stringify(
      upgradeInfo,
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
