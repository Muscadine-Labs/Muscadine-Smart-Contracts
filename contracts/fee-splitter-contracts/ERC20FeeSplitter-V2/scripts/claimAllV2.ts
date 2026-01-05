import { ethers } from "hardhat";
import { ERC20FeeSplitterV2, IERC20 } from "../../../../typechain-types";

type TokenContext = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  contract: IERC20;
};

async function loadTokenContext(address: string): Promise<TokenContext> {
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

  return { address, symbol, name, decimals, contract };
}

/**
 * Claim tokens for all payees.
 *
 * If TOKEN_ADDRESS is provided, claims only that token (more gas efficient for single token).
 * If TOKEN_ADDRESS is not provided, claims all configured tokens.
 *
 * Usage:
 *   # Claim all configured tokens
 *   CONTRACT_ADDRESS=0x... npx hardhat run contracts/fee-splitter-contracts/ERC20FeeSplitter-V2/scripts/claimAllV2.ts --network base
 *
 *   # Claim a specific token only
 *   CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npx hardhat run contracts/fee-splitter-contracts/ERC20FeeSplitter-V2/scripts/claimAllV2.ts --network base
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }

  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  const claimableTokens = await splitter.getClaimableTokens();

  // Determine which tokens to process
  const tokensToProcess: string[] = TOKEN_ADDRESS ? [TOKEN_ADDRESS] : claimableTokens;

  if (tokensToProcess.length === 0) {
    if (TOKEN_ADDRESS) {
      console.log("\n⚠️  Provided TOKEN_ADDRESS is not configured as claimable.");
      console.log("Use manageClaimableTokens.ts to add it to the claimable tokens list.");
    } else {
      console.log(
        "\n⚠️  No claimable tokens configured. Use manageClaimableTokens.ts to add some.",
      );
    }
    return;
  }

  // Verify single token mode
  if (TOKEN_ADDRESS) {
    const isClaimable = claimableTokens.some(
      (addr) => addr.toLowerCase() === TOKEN_ADDRESS.toLowerCase(),
    );
    if (!isClaimable) {
      throw new Error(
        `Token ${TOKEN_ADDRESS} is not in the claimable tokens list. Use manageClaimableTokens.ts to add it.`,
      );
    }
  }

  console.log("Claiming tokens with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  if (TOKEN_ADDRESS) {
    console.log("Token address:", TOKEN_ADDRESS);
    console.log("Mode: Single token (gas efficient)");
  } else {
    console.log("Mode: All configured tokens");
  }

  // Load token contexts
  const tokenContexts: TokenContext[] = [];
  for (const tokenAddress of tokensToProcess) {
    const context = await loadTokenContext(tokenAddress);
    tokenContexts.push(context);
  }

  // Get payees
  const payees = await splitter.getAllPayees();
  const payeeInfos = await Promise.all(
    payees.map(async (payee) => {
      const info = await splitter.getPayeeInfo(payee);
      return { address: payee, shares: info.shares };
    }),
  );

  console.log(`\nPayees (${payeeInfos.length}):`);
  payeeInfos.forEach((info, index) =>
    console.log(`  ${index + 1}. ${info.address} (${info.shares} shares)`),
  );

  // Show pending amounts
  console.log("\nConfigured tokens and pending balances:");
  let grandPending = 0n;
  for (const token of tokenContexts) {
    console.log(`\n- ${token.name} (${token.symbol}) @ ${token.address}`);
    let tokenPending = 0n;
    for (const payee of payeeInfos) {
      const pending = await splitter.pendingToken(token.address, payee.address);
      tokenPending += pending;
      console.log(
        `    ${payee.address}: ${ethers.formatUnits(pending, token.decimals)} ${token.symbol}`,
      );
    }
    console.log(
      `    Total pending: ${ethers.formatUnits(tokenPending, token.decimals)} ${token.symbol}`,
    );
    grandPending += tokenPending;
  }

  if (grandPending === 0n) {
    console.log("\n⚠️  No tokens to claim!");
    return;
  }

  // Capture balances before
  const balancesBefore: Record<string, Record<string, bigint>> = {};
  for (const token of tokenContexts) {
    balancesBefore[token.address] = {};
    for (const payee of payeeInfos) {
      balancesBefore[token.address][payee.address] = await token.contract.balanceOf(payee.address);
    }
  }

  // Execute claim
  console.log("\nClaiming tokens for all payees...");
  const tx = TOKEN_ADDRESS
    ? await splitter.claimAllForToken(TOKEN_ADDRESS)
    : await splitter.claimAll();
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

  // Show claimed amounts
  console.log("\n✅ Claimed amounts:");
  for (const token of tokenContexts) {
    console.log(`\n- ${token.name} (${token.symbol})`);
    let tokenClaimed = 0n;
    for (const payee of payeeInfos) {
      const balanceAfter = await token.contract.balanceOf(payee.address);
      const claimed = balanceAfter - balancesBefore[token.address][payee.address];
      tokenClaimed += claimed;
      console.log(
        `    ${payee.address}: ${ethers.formatUnits(claimed, token.decimals)} ${token.symbol}`,
      );
    }
    console.log(
      `    Total claimed: ${ethers.formatUnits(tokenClaimed, token.decimals)} ${token.symbol}`,
    );
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
