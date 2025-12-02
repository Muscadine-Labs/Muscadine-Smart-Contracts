import { Contract } from "ethers";
import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../typechain-types";

type TokenContext = {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  contract: Contract;
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
 * Claim all configured tokens for every payee
 *
 * Usage:
 *   CONTRACT_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/claimAllV2.ts --network base
 */
async function main() {
  const [signer] = await ethers.getSigners();
  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in .env file or environment variable");
  }

  console.log("Claiming tokens with account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);

  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  const claimableTokens = await splitter.getClaimableTokens();
  if (claimableTokens.length === 0) {
    console.log("\n⚠️  No claimable tokens configured. Use addClaimableToken first.");
    return;
  }

  const tokenContexts: TokenContext[] = [];
  for (const tokenAddress of claimableTokens) {
    const context = await loadTokenContext(tokenAddress);
    tokenContexts.push(context);
  }

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

  const balancesBefore: Record<string, Record<string, bigint>> = {};
  for (const token of tokenContexts) {
    balancesBefore[token.address] = {};
    for (const payee of payeeInfos) {
      balancesBefore[token.address][payee.address] = await token.contract.balanceOf(payee.address);
    }
  }

  console.log("\nClaiming tokens for all payees...");
  const tx = await splitter.claimAll();
  console.log("Transaction hash:", tx.hash);

  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

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
