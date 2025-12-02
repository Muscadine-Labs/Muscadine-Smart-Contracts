import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

/**
 * Check pending token amounts for all payees.
 *
 * Usage:
 *   # Check every configured claimable token
 *   CONTRACT_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/checkPending.ts --network base
 *
 *   # Force a specific token address (even if not in claimable list)
 *   CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run ...
 */
async function main() {
  const [signer] = await ethers.getSigners();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }
  console.log("Checking pending amounts with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);

  // Get contract instance
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  const selectedTokens =
    TOKEN_ADDRESS !== undefined
      ? [TOKEN_ADDRESS]
      : await splitter.getClaimableTokens();

  if (selectedTokens.length === 0) {
    if (TOKEN_ADDRESS) {
      console.log("\n⚠️  Provided TOKEN_ADDRESS has no pending amounts configured.");
    } else {
      console.log("\n⚠️  No claimable tokens configured. Use manageClaimableTokens.ts to add some.");
    }
    return;
  }

  const allPayees = await splitter.getAllPayees();
  const payeeCount = await splitter.getPayeeCount();
  const totalShares = await splitter.totalShares();

  console.log("\n=== Payee Information ===");
  console.log("Total payees:", payeeCount.toString());
  console.log("Total shares:", totalShares.toString());

  let tokensWithPending = 0;
  for (const tokenAddress of selectedTokens) {
    console.log("\n==================================================");
    console.log("Token address:", tokenAddress);
    const hasPending = await reportToken(
      splitter,
      tokenAddress,
      allPayees,
      totalShares,
      CONTRACT_ADDRESS,
    );
    if (hasPending) tokensWithPending += 1;
  }

  console.log("\n==================================================");
  console.log(`Tokens with pending balances: ${tokensWithPending} / ${selectedTokens.length}`);

  async function reportToken(
    splitter: ERC20FeeSplitterV2,
    tokenAddress: string,
    payees: string[],
    totalShares: bigint,
    contractAddress: string,
  ): Promise<boolean> {
    const token = await ethers.getContractAt("IERC20", tokenAddress);

    let tokenName = "Unknown";
    let tokenSymbol = "UNKNOWN";
    let tokenDecimals = 18;

    try {
      const nameResult = await (token as any).name();
      if (nameResult) tokenName = nameResult;
    } catch {}

    try {
      const symbolResult = await (token as any).symbol();
      if (symbolResult) tokenSymbol = symbolResult;
    } catch {}

    try {
      const decimalsResult = await (token as any).decimals();
      if (decimalsResult !== null && decimalsResult !== undefined) {
        tokenDecimals = Number(decimalsResult);
      }
    } catch {}

    console.log(`Token: ${tokenName} (${tokenSymbol})`);

    const contractBalance = await token.balanceOf(contractAddress);
    console.log(
      `Contract balance: ${ethers.formatUnits(contractBalance, tokenDecimals)} ${tokenSymbol}`,
    );

    console.log("\n--- Pending Amounts ---");
    let totalPending = 0n;

    for (let i = 0; i < payees.length; i++) {
      const payee = payees[i];
      const info = await splitter.getPayeeInfo(payee);
      const pending = await splitter.pendingToken(tokenAddress, payee);
      const percentage = (Number(info.shares) / Number(totalShares)) * 100;

      totalPending += pending;

      console.log(`Payee ${i + 1}: ${payee}`);
      console.log(`  Shares: ${info.shares.toString()} (${percentage.toFixed(2)}%)`);
      console.log(`  Pending: ${ethers.formatUnits(pending, tokenDecimals)} ${tokenSymbol}`);
    }

    console.log("\n--- Token Summary ---");
    console.log(
      `Total pending: ${ethers.formatUnits(totalPending, tokenDecimals)} ${tokenSymbol}`,
    );
    console.log(
      `Contract balance: ${ethers.formatUnits(contractBalance, tokenDecimals)} ${tokenSymbol}`,
    );

    if (totalPending > 0n) {
      console.log("💡 Tokens are available to claim for this ERC20.");
    } else {
      console.log("⚠️  No tokens pending for any payee.");
    }

    return totalPending > 0n;
  }
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
