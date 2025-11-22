import { ethers } from "hardhat";

/**
 * Claim all tokens for all payees in ERC20FeeSplitter (V1)
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter/scripts/claimAllV1.ts --network base
 */
async function main() {
  const [signer] = await ethers.getSigners();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }
  if (!TOKEN_ADDRESS) {
    throw new Error("Please set TOKEN_ADDRESS in .env file or environment variable");
  }

  console.log("Claiming tokens with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Token address:", TOKEN_ADDRESS);

  // Get contract instance
  const ERC20FeeSplitter = await ethers.getContractFactory("ERC20FeeSplitter");
  const splitter = ERC20FeeSplitter.attach(CONTRACT_ADDRESS);

  // Get token instance
  const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);

  // Get token info
  const tokenName = await token.name().catch(() => "Unknown");
  const tokenSymbol = await token.symbol().catch(() => "UNKNOWN");
  const tokenDecimals = await token.decimals().catch(() => 18);

  console.log(`\nToken: ${tokenName} (${tokenSymbol})`);

  // Get payees
  const payee1 = await splitter.PAYEE1();
  const payee2 = await splitter.PAYEE2();

  console.log("\nPayees:");
  console.log("  Payee 1 (Nick):", payee1);
  console.log("  Payee 2 (Ignas):", payee2);

  // Check pending amounts
  const pending1 = await splitter.pendingToken(token, payee1);
  const pending2 = await splitter.pendingToken(token, payee2);

  console.log("\nPending amounts:");
  console.log(`  Payee 1: ${ethers.formatUnits(pending1, tokenDecimals)} ${tokenSymbol}`);
  console.log(`  Payee 2: ${ethers.formatUnits(pending2, tokenDecimals)} ${tokenSymbol}`);
  console.log(`  Total: ${ethers.formatUnits(pending1 + pending2, tokenDecimals)} ${tokenSymbol}`);

  if (pending1 === BigInt(0) && pending2 === BigInt(0)) {
    console.log("\n⚠️  No tokens to claim!");
    return;
  }

  // Get balances before
  const balance1Before = await token.balanceOf(payee1);
  const balance2Before = await token.balanceOf(payee2);

  // Claim all
  console.log("\nClaiming tokens for all payees...");
  const tx = await splitter.claimAll(token);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

  // Get balances after
  const balance1After = await token.balanceOf(payee1);
  const balance2After = await token.balanceOf(payee2);

  const claimed1 = balance1After - balance1Before;
  const claimed2 = balance2After - balance2Before;

  console.log("\n✅ Claimed amounts:");
  console.log(`  Payee 1: ${ethers.formatUnits(claimed1, tokenDecimals)} ${tokenSymbol}`);
  console.log(`  Payee 2: ${ethers.formatUnits(claimed2, tokenDecimals)} ${tokenSymbol}`);
  console.log(`  Total: ${ethers.formatUnits(claimed1 + claimed2, tokenDecimals)} ${tokenSymbol}`);
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
