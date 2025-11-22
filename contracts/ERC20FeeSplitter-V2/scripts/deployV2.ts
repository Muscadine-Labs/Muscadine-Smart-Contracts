import { ethers, upgrades, run } from "hardhat";

/**
 * Deploy ERC20FeeSplitterV2 - Upgradeable fee splitter with dynamic payee management
 *
 * Initial Configuration:
 * - Ignas: 3 shares (1.5%)
 * - Nick: 3 shares (1.5%)
 * - Muscadine Labs: 4 shares (2.0%)
 * - Total: 10 shares (5%)
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

  // Owner can be set via environment variable (for multi-sig) or defaults to Nick's wallet
  const OWNER = process.env.OWNER_ADDRESS || NICK;

  console.log("\n=== Initial Configuration ===");
  console.log("Ignas:        ", IGNAS, "(3 shares, 1.5%)");
  console.log("Nick:         ", NICK, "(3 shares, 1.5%)");
  console.log("Muscadine Labs:", MUSCADINE_LABS, "(4 shares, 2.0%)");
  console.log("Total shares: ", initialShares.reduce((a, b) => a + b, 0), "(5%)");
  console.log("Owner:        ", OWNER);
  if (OWNER === NICK) {
    console.log("             (Nick's wallet)");
  } else if (OWNER !== deployer.address) {
    console.log("             (Custom owner address)");
  }

  // Deploy implementation and proxy
  const ERC20FeeSplitterV2 = await ethers.getContractFactory("ERC20FeeSplitterV2");
  
  console.log("\nDeploying upgradeable contract (UUPS proxy)...");
  const splitter = await upgrades.deployProxy(
    ERC20FeeSplitterV2,
    [initialPayees, initialShares, OWNER],
    { kind: "uups", initializer: "initialize" }
  );
  await splitter.waitForDeployment();

  const proxyAddress = await splitter.getAddress();
  const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log("\n=== Deployment Successful ===");
  console.log("Proxy address:        ", proxyAddress);
  console.log("Implementation address:", implementationAddress);

  // Verify configuration
  console.log("\n=== Configuration Verification ===");
  console.log("Owner:", await splitter.owner());
  console.log("Total shares:", await splitter.totalShares());
  console.log("Payee count:", await splitter.getPayeeCount());

  const allPayees = await splitter.getAllPayees();
  for (let i = 0; i < allPayees.length; i++) {
    const payee = allPayees[i];
    const info = await splitter.getPayeeInfo(payee);
    const percentage = (Number(info.shares) / Number(await splitter.totalShares())) * 100;
    console.log(`Payee ${i + 1}: ${payee} - ${info.shares} shares (${percentage}%)`);
  }

  console.log("\n=== Important ===");
  console.log("This contract is UPGRADEABLE:");
  console.log("- Owner can upgrade the contract implementation");
  console.log("- Owner can add/remove/update payees");
  console.log("- Owner can transfer ownership");
  console.log("");
  console.log("⚠️  SECURITY: The contract uses a single owner address.");
  console.log("   For production, use a MULTI-SIG WALLET as the owner.");
  console.log("   This way multiple signatures are required for upgrades/changes,");
  console.log("   but the contract still sees it as a single owner address.");
  console.log("");
  console.log("To upgrade in the future:");
  console.log("1. Deploy new implementation");
  console.log("2. Call upgrade() from owner account");
  console.log("3. Proxy address remains the same");

  // Automatic verification (if BASESCAN_API_KEY is set)
  const basescanApiKey = process.env.BASESCAN_API_KEY;
  const network = await ethers.provider.getNetwork();
  const isBaseNetwork = network.chainId === 8453n || network.name === "base";

  if (basescanApiKey && isBaseNetwork) {
    console.log("\n=== Verifying Contracts on Basescan ===");
    
    try {
      // Wait a bit for Basescan to index the contract
      console.log("Waiting for Basescan to index contracts...");
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

      // Verify implementation contract
      console.log("Verifying implementation contract...");
      try {
        await run("verify:verify", {
          address: implementationAddress,
          constructorArguments: [],
        });
        console.log("✅ Implementation contract verified!");
      } catch (error: any) {
        if (error.message?.includes("Already Verified")) {
          console.log("✅ Implementation contract already verified");
        } else {
          console.log("⚠️  Implementation verification failed:", error.message);
          console.log(`   Manual verification: npx hardhat verify --network base ${implementationAddress}`);
        }
      }

      // Wait a bit more
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds

      // Verify proxy contract
      console.log("Verifying proxy contract...");
      try {
        await run("verify:verify", {
          address: proxyAddress,
          constructorArguments: [],
        });
        console.log("✅ Proxy contract verified!");
      } catch (error: any) {
        if (error.message?.includes("Already Verified")) {
          console.log("✅ Proxy contract already verified");
        } else {
          console.log("⚠️  Proxy verification failed:", error.message);
          console.log(`   Manual verification: npx hardhat verify --network base ${proxyAddress}`);
        }
      }

      console.log("\n✅ Verification complete!");
      console.log(`View on Basescan: https://basescan.org/address/${proxyAddress}`);
    } catch (error: any) {
      console.log("\n⚠️  Automatic verification encountered an error");
      console.log("You can verify manually:");
      console.log(`   npx hardhat verify --network base ${implementationAddress}`);
      console.log(`   npx hardhat verify --network base ${proxyAddress}`);
    }
  } else {
    console.log("\n=== Next Steps ===");
    if (!basescanApiKey) {
      console.log("⚠️  BASESCAN_API_KEY not set - skipping automatic verification");
    }
    if (!isBaseNetwork) {
      console.log("⚠️  Not on Base network - skipping automatic verification");
    }
    console.log("1. Verify proxy contract on Basescan:");
    console.log(`   npx hardhat verify --network base ${proxyAddress}`);
    console.log("");
    console.log("2. Verify implementation contract:");
    console.log(`   npx hardhat verify --network base ${implementationAddress}`);
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
    proxy: proxyAddress,
    implementation: implementationAddress,
    payees: initialPayees,
    shares: initialShares,
    totalShares: initialShares.reduce((a, b) => a + b, 0),
    owner: OWNER,
    upgradeable: true,
    upgradePattern: "UUPS",
  };

  console.log("\n=== Deployment Info (SAVE THIS) ===");
  console.log(JSON.stringify(deploymentInfo, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

