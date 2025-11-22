import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

/**
 * Claim all tokens for all payees in ERC20FeeSplitterV2
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/claimAllV2.ts --network base
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
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  // Get token instance
  const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);

  // Try to get token metadata (name, symbol, decimals) - not all tokens implement these
  let tokenName = "Unknown";
  let tokenSymbol = "UNKNOWN";
  let tokenDecimals = 18;

  try {
    const nameResult = await (token as any).name();
    if (nameResult) tokenName = nameResult;
  } catch {
    // Token doesn't implement name()
  }

  try {
    const symbolResult = await (token as any).symbol();
    if (symbolResult) tokenSymbol = symbolResult;
  } catch {
    // Token doesn't implement symbol()
  }

  try {
    const decimalsResult = await (token as any).decimals();
    if (decimalsResult !== null && decimalsResult !== undefined) {
      tokenDecimals = Number(decimalsResult);
    }
  } catch {
    // Token doesn't implement decimals(), default to 18
  }

  console.log(`\nToken: ${tokenName} (${tokenSymbol})`);

  // Get all payees
  const allPayees = await splitter.getAllPayees();
  const payeeCount = await splitter.getPayeeCount();

  console.log(`\nPayees (${payeeCount}):`);
  const payeeInfo: Array<{ address: string; shares: bigint; pending: bigint }> = [];

  for (let i = 0; i < allPayees.length; i++) {
    const payee = allPayees[i];
    const info = await splitter.getPayeeInfo(payee);
    const pending = await splitter.pendingToken(token, payee);
    payeeInfo.push({ address: payee, shares: info.shares, pending });
    console.log(`  Payee ${i + 1}: ${payee} (${info.shares} shares)`);
  }

  // Check pending amounts
  console.log("\nPending amounts:");
  let totalPending = BigInt(0);
  for (const info of payeeInfo) {
    console.log(
      `  ${info.address}: ${ethers.formatUnits(info.pending, tokenDecimals)} ${tokenSymbol}`,
    );
    totalPending += info.pending;
  }
  console.log(`  Total: ${ethers.formatUnits(totalPending, tokenDecimals)} ${tokenSymbol}`);

  if (totalPending === BigInt(0)) {
    console.log("\n⚠️  No tokens to claim!");
    return;
  }

  // Get balances before
  const balancesBefore: Record<string, bigint> = {};
  for (const info of payeeInfo) {
    balancesBefore[info.address] = await token.balanceOf(info.address);
  }

  // Claim all
  console.log("\nClaiming tokens for all payees...");
  const tx = await splitter.claimAll(token);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

  // Get balances after and calculate claimed amounts
  console.log("\n✅ Claimed amounts:");
  let totalClaimed = BigInt(0);
  for (const info of payeeInfo) {
    const balanceAfter = await token.balanceOf(info.address);
    const claimed = balanceAfter - balancesBefore[info.address];
    totalClaimed += claimed;
    console.log(`  ${info.address}: ${ethers.formatUnits(claimed, tokenDecimals)} ${tokenSymbol}`);
  }
  console.log(`  Total: ${ethers.formatUnits(totalClaimed, tokenDecimals)} ${tokenSymbol}`);
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
