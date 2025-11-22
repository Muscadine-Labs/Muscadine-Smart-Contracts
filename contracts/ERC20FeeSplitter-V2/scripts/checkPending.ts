import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

/**
 * Check pending token amounts for all payees in ERC20FeeSplitterV2
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/checkPending.ts --network base
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

  console.log("Checking pending amounts with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Token address:", TOKEN_ADDRESS);

  // Get contract instance
  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  // Get token instance
  const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);

  // Try to get token metadata
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

  console.log(`\nToken: ${tokenName} (${tokenSymbol})`);

  // Get contract balance
  const contractBalance = await token.balanceOf(CONTRACT_ADDRESS);
  console.log(
    `Contract balance: ${ethers.formatUnits(contractBalance, tokenDecimals)} ${tokenSymbol}`,
  );

  // Get all payees
  const allPayees = await splitter.getAllPayees();
  const payeeCount = await splitter.getPayeeCount();
  const totalShares = await splitter.totalShares();

  console.log("\n=== Payee Information ===");
  console.log("Total payees:", payeeCount.toString());
  console.log("Total shares:", totalShares.toString());

  console.log("\n=== Pending Amounts ===");
  let totalPending = BigInt(0);

  for (let i = 0; i < allPayees.length; i++) {
    const payee = allPayees[i];
    const info = await splitter.getPayeeInfo(payee);
    const pending = await splitter.pendingToken(token, payee);
    const percentage = (Number(info.shares) / Number(totalShares)) * 100;

    totalPending += pending;

    console.log("\nPayee " + (i + 1) + ":", payee);
    console.log("  Shares:", info.shares.toString(), "(" + percentage.toFixed(2) + "%)");
    console.log("  Pending:", ethers.formatUnits(pending, tokenDecimals), tokenSymbol);
  }

  console.log("\n=== Summary ===");
  console.log("Total pending:", ethers.formatUnits(totalPending, tokenDecimals), tokenSymbol);
  console.log("Contract balance:", ethers.formatUnits(contractBalance, tokenDecimals), tokenSymbol);

  if (totalPending > BigInt(0)) {
    console.log("\n💡 Tokens are available to claim!");
    console.log(
      "   Run: CONTRACT_ADDRESS=" +
        CONTRACT_ADDRESS +
        " TOKEN_ADDRESS=" +
        TOKEN_ADDRESS +
        " npm run claim:v2:base",
    );
  } else {
    console.log("\n⚠️  No tokens pending for any payee");
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
