import { ethers, run } from "hardhat";

/**
 * Deploy ERC20FeeSplitterV2 - Fee splitter with dynamic payee management and multi-owner support
 *
 * Initial Configuration:
 * - Ignas: 3 shares (1.5%)
 * - Nick: 3 shares (1.5%)
 * - Muscadine Labs: 4 shares (2.0%)
 * - Total: 10 shares (5%)
 * - Owners: Set via OWNER_ADDRESSES env var (comma-separated) or defaults to Nick's wallet
 */
async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying ERC20FeeSplitterV2 with account:", deployer.address);
  console.log(
    "Account balance:",
    ethers.formatEther(await ethers.provider.getBalance(deployer.address)),
    "ETH",
  );

  // PRODUCTION CONFIGURATION
  const IGNAS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
  const NICK = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
  const MUSCADINE_LABS = "0x057fd8B961Eb664baA647a5C7A6e9728fabA266A"; // Muscadine Labs Treasury

  const initialPayees = [IGNAS, NICK, MUSCADINE_LABS];
  const initialShares = [3, 3, 4]; // Total: 10 shares (5% of fees)

  // Owners can be set via environment variable (comma-separated) or defaults to Nick's wallet
  const OWNERS_ENV = process.env.OWNER_ADDRESSES || process.env.OWNER_ADDRESS;
  const initialOwners = OWNERS_ENV
    ? OWNERS_ENV.split(",").map((addr) => addr.trim())
    : [NICK]; // Default to Nick's wallet

  console.log("\n=== Initial Configuration ===");
  console.log("Ignas:        ", IGNAS, "(3 shares, 1.5%)");
  console.log("Nick:         ", NICK, "(3 shares, 1.5%)");
  console.log("Muscadine Labs:", MUSCADINE_LABS, "(4 shares, 2.0%)");
  console.log(
    "Total shares: ",
    initialShares.reduce((a, b) => a + b, 0),
    "(5%)",
  );
  console.log("Owners:       ", initialOwners.length, "owner(s)");
  for (let i = 0; i < initialOwners.length; i++) {
    console.log(`  Owner ${i + 1}:`, initialOwners[i]);
  }

  // Deploy contract directly (no proxy)
  const ERC20FeeSplitterV2 = await ethers.getContractFactory("ERC20FeeSplitterV2");

  console.log("\nDeploying contract...");
  const splitter = await ERC20FeeSplitterV2.deploy(initialPayees, initialShares, initialOwners);
  await splitter.waitForDeployment();
  const contractAddress = await splitter.getAddress();

  console.log("\n=== Deployment Successful ===");
  console.log("Contract address:     ", contractAddress);

  // Verify configuration
  console.log("\n=== Configuration Verification ===");
  try {
    const ownerCount = await splitter.getOwnerCount();
    console.log("Owner count:", ownerCount);
    const allOwners = await splitter.getAllOwners();
    console.log("Owners:", allOwners);
    const totalShares = await splitter.totalShares();
    console.log("Total shares:", totalShares);
    const payeeCount = await splitter.getPayeeCount();
    console.log("Payee count:", payeeCount);
  } catch (error: any) {
    console.log("⚠️  Warning: Could not verify configuration:", error.message);
    console.log("   The contract may need a moment to initialize on-chain.");
    console.log("   You can verify manually by calling the contract functions.");
  }

  try {
    const allPayees = await splitter.getAllPayees();
    for (let i = 0; i < allPayees.length; i++) {
      const payee = allPayees[i];
      const info = await splitter.getPayeeInfo(payee);
      const percentage = (Number(info.shares) / Number(await splitter.totalShares())) * 100;
      console.log(`Payee ${i + 1}: ${payee} - ${info.shares} shares (${percentage}%)`);
    }
  } catch (error: any) {
    console.log("⚠️  Could not retrieve payee information:", error.message);
  }

  console.log("\n=== Important ===");
  console.log("This contract is IMMUTABLE:");
  console.log("- Contract cannot be upgraded");
  console.log("- Owners can add/remove/update payees");
  console.log("- Owners can add/remove other owners");
  console.log("");
  console.log("⚠️  SECURITY: The contract supports multiple owners.");
  console.log("   For production, add multiple owners for better security.");
  console.log("   Each owner can manage payees and other owners.");

  // Automatic verification (if BASESCAN_API_KEY is set)
  const basescanApiKey = process.env.BASESCAN_API_KEY;
  const network = await ethers.provider.getNetwork();
  const isBaseNetwork = network.chainId === 8453n || network.name === "base";

  if (basescanApiKey && isBaseNetwork) {
    console.log("\n=== Verifying Contracts on Basescan ===");

    try {
      // Wait a bit for Basescan to index the contract
      console.log("Waiting for Basescan to index contracts...");
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds

      // Verify contract
      console.log("Verifying contract...");
      try {
        await run("verify:verify", {
          address: contractAddress,
          constructorArguments: [initialPayees, initialShares, initialOwners],
        });
        console.log("✅ Contract verified!");
      } catch (error: any) {
        if (error.message?.includes("Already Verified")) {
          console.log("✅ Contract already verified");
        } else {
          console.log("⚠️  Contract verification failed:", error.message);
          console.log(
            `   Manual verification: npx hardhat verify --network base ${contractAddress} "${initialPayees}" "${initialShares}" "${initialOwners}"`,
          );
        }
      }

      console.log("\n✅ Verification complete!");
      console.log(`View on Basescan: https://basescan.org/address/${contractAddress}`);
    } catch (error: any) {
      console.log("\n⚠️  Automatic verification encountered an error");
      console.log("You can verify manually:");
      console.log(`   npx hardhat verify --network base ${contractAddress} "${initialPayees}" "${initialShares}" "${initialOwners}"`);
    }
  } else {
    console.log("\n=== Next Steps ===");
    if (!basescanApiKey) {
      console.log("⚠️  BASESCAN_API_KEY not set - skipping automatic verification");
    }
    if (!isBaseNetwork) {
      console.log("⚠️  Not on Base network - skipping automatic verification");
    }
    console.log("Verify contract on Basescan:");
    console.log(`   npx hardhat verify --network base ${contractAddress} "${initialPayees}" "${initialShares}" "${initialOwners}"`);
    console.log("");
  }

  console.log("\n=== Additional Steps ===");
  console.log("1. Update Muscadine Labs address if needed:");
  console.log(`   splitter.updatePayeeShares(${MUSCADINE_LABS}, 4)`);
  console.log("");
  console.log("2. Set as fee recipient in your Morpho vaults");
  console.log("3. Start receiving and splitting fees!");

  // Save deployment info
  const deploymentInfo = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contractAddress: contractAddress,
    payees: initialPayees,
    shares: initialShares,
    totalShares: initialShares.reduce((a, b) => a + b, 0),
    owners: initialOwners,
    ownerCount: initialOwners.length,
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

// Only execute if run directly (not during tests)
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
