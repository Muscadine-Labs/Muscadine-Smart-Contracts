import { ethers, run } from "hardhat";

/**
 * Deploy ERC20FeeSplitterV2 - Fee splitter with dynamic payee management and multi-owner support
 *
 * Initial Configuration:
 * - Payee 1: 1 share
 * - Payee 2: 1 share
 * - Payee 3: 3 shares
 * - Total: 5 shares
 * - Owners: Set via OWNER_ADDRESSES env var (comma-separated) or defaults to Payee 1 and Payee 2
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
  const PAYEE1 = "0x1111111111111111111111111111111111111111" as const;
  const PAYEE2 = "0x2222222222222222222222222222222222222222" as const;
  const PAYEE3 = "0x3333333333333333333333333333333333333333" as const;

  const initialPayees = [PAYEE1, PAYEE2, PAYEE3];
  const initialShares = [1, 1, 3]; // Total: 5 shares

  const initialClaimableTokens = [
    "0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F",
    "0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9",
    "0x21e0d366272798da3A977FEBA699FCB91959d120",
    "0x89712980Cb434Ef5AE4aB29349419eB976b0B496",
    "0xd6DCaD2f7DA91fbB27bdA471540D9770C97a5A43",
    "0x99dCd0D75822ba398f13b2A8852B07c7E137Ec70",
  ];

  // Owners can be set via environment variable (comma-separated) or defaults to Payee1 and Payee2
  const OWNERS_ENV = process.env.OWNER_ADDRESSES || process.env.OWNER_ADDRESS;
  const initialOwners = OWNERS_ENV
    ? OWNERS_ENV.split(",").map((addr) => addr.trim())
    : [PAYEE1, PAYEE2]; // Default to Payee1 and Payee2

  console.log("\n=== Initial Configuration ===");
  console.log("Payee 1:", PAYEE1, "(1 share)");
  console.log("Payee 2:", PAYEE2, "(1 share)");
  console.log("Payee 3:", PAYEE3, "(3 shares)");
  console.log(
    "Total shares: ",
    initialShares.reduce((a, b) => a + b, 0),
  );
  console.log("Owners:       ", initialOwners.length, "owner(s)");
  for (let i = 0; i < initialOwners.length; i++) {
    console.log(`  Owner ${i + 1}:`, initialOwners[i]);
  }
  console.log("Claimable tokens:");
  initialClaimableTokens.forEach((token, idx) => console.log(`  Token ${idx + 1}: ${token}`));

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

  console.log("\n=== Initial Claimable Tokens ===");
  for (const token of initialClaimableTokens) {
    try {
      const tx = await splitter.addClaimableToken(token);
      await tx.wait();
      console.log(`✅ Added claimable token: ${token}`);
    } catch (error: any) {
      if (error.message?.includes("ClaimableTokenAlreadyExists")) {
        console.log(`ℹ️  Token already configured: ${token}`);
      } else {
        console.log(`⚠️  Failed to add token ${token}:`, error.message);
      }
    }
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
      console.log(
        `   npx hardhat verify --network base ${contractAddress} "${initialPayees}" "${initialShares}" "${initialOwners}"`,
      );
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
    console.log(
      `   npx hardhat verify --network base ${contractAddress} "${initialPayees}" "${initialShares}" "${initialOwners}"`,
    );
    console.log("");
  }

  console.log("\n=== Additional Steps ===");
  console.log("1. Update Payee 3 address if needed:");
  console.log(`   splitter.updatePayeeShares(${PAYEE3}, 3)`);
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
