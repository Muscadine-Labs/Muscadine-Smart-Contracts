import { Contract } from "ethers";
import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

async function loadTokenMetadata(address: string) {
  const contract = await ethers.getContractAt("IERC20", address);

  let name = "Unknown";
  let symbol = "UNKNOWN";
  let decimals = 18;

  try {
    const value = await (contract as any).name();
    if (value) name = value;
  } catch {
    // optional metadata
  }

  try {
    const value = await (contract as any).symbol();
    if (value) symbol = value;
  } catch {
    // optional metadata
  }

  try {
    const value = await (contract as any).decimals();
    if (value !== null && value !== undefined) decimals = Number(value);
  } catch {
    // optional metadata
  }

  return { name, symbol, decimals };
}

/**
 * Claim a specific token for all payees (more gas efficient than claimAll for single token)
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/claimAllForToken.ts --network base
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

  console.log("Claiming token for all payees with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Token address:", TOKEN_ADDRESS);

  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  // Verify token is claimable
  const claimableTokens = await splitter.getClaimableTokens();
  const isClaimable = claimableTokens.some((addr) => addr.toLowerCase() === TOKEN_ADDRESS.toLowerCase());

  if (!isClaimable) {
    throw new Error(
      `Token ${TOKEN_ADDRESS} is not in the claimable tokens list. Use manageClaimableTokens.ts to add it.`,
    );
  }

  const tokenMetadata = await loadTokenMetadata(TOKEN_ADDRESS);
  const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);

  const payees = await splitter.getAllPayees();
  const payeeInfos = await Promise.all(
    payees.map(async (payee) => {
      const info = await splitter.getPayeeInfo(payee);
      return { address: payee, shares: info.shares };
    }),
  );

  console.log(`\nToken: ${tokenMetadata.name} (${tokenMetadata.symbol})`);
  console.log(`Payees (${payeeInfos.length}):`);
  payeeInfos.forEach((info, index) =>
    console.log(`  ${index + 1}. ${info.address} (${info.shares} shares)`),
  );

  console.log("\nPending amounts:");
  let totalPending = 0n;
  const balancesBefore: Record<string, bigint> = {};

  for (const payee of payeeInfos) {
    const pending = await splitter.pendingToken(TOKEN_ADDRESS, payee.address);
    totalPending += pending;
    balancesBefore[payee.address] = await token.balanceOf(payee.address);
    console.log(
      `  ${payee.address}: ${ethers.formatUnits(pending, tokenMetadata.decimals)} ${tokenMetadata.symbol}`,
    );
  }

  console.log(
    `\nTotal pending: ${ethers.formatUnits(totalPending, tokenMetadata.decimals)} ${tokenMetadata.symbol}`,
  );

  if (totalPending === 0n) {
    console.log("\n⚠️  No tokens to claim for this token!");
    return;
  }

  console.log("\nClaiming token for all payees...");
  const tx = await splitter.claimAllForToken(TOKEN_ADDRESS);
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

  console.log("\n✅ Claimed amounts:");
  let totalClaimed = 0n;
  for (const payee of payeeInfos) {
    const balanceAfter = await token.balanceOf(payee.address);
    const claimed = balanceAfter - balancesBefore[payee.address];
    totalClaimed += claimed;
    console.log(
      `  ${payee.address}: ${ethers.formatUnits(claimed, tokenMetadata.decimals)} ${tokenMetadata.symbol}`,
    );
  }
  console.log(
    `\nTotal claimed: ${ethers.formatUnits(totalClaimed, tokenMetadata.decimals)} ${tokenMetadata.symbol}`,
  );
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

