import { ethers } from "hardhat";

/**
 * Claim tokens for a single token address (workaround after payee removal)
 * 
 * Usage:
 *   TOKEN_ADDRESS=0x... npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/claimSingleToken.ts --network base
 * 
 * Make sure PRIVATE_KEY is set in .env file
 */
async function main() {
  // Contract address (deployed on Base)
  const CONTRACT_ADDRESS = "0x3690Eb8735fE51c695d2f2Da289D1FA447137E24";
  
  // Remaining payees (after removing 0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333)
  const PAYEES = [
    "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261",
    "0x057fd8B961Eb664baA647a5C7A6e9728fabA266A",
  ];

  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
  
  if (!TOKEN_ADDRESS) {
    throw new Error("Please set TOKEN_ADDRESS in environment variable");
  }

  if (!process.env.PRIVATE_KEY) {
    throw new Error("Please set PRIVATE_KEY in .env file");
  }

  const [signer] = await ethers.getSigners();

  console.log("=".repeat(80));
  console.log("Single Token Claim Workaround");
  console.log("=".repeat(80));
  console.log("Account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Token address:", TOKEN_ADDRESS);
  console.log("\n" + "=".repeat(80) + "\n");

  // Get contract instance
  const splitter = await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  );

  // Get token instance
  const token = await ethers.getContractAt("IERC20", TOKEN_ADDRESS);

  // Try to get token metadata
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

  console.log(`Token: ${tokenName} (${tokenSymbol})`);
  console.log(`Decimals: ${tokenDecimals}\n`);

  // Check contract balance
  const contractBalance = await token.balanceOf(CONTRACT_ADDRESS);
  console.log(`Contract balance: ${ethers.formatUnits(contractBalance, tokenDecimals)} ${tokenSymbol}\n`);

  if (contractBalance === BigInt(0)) {
    console.log("⚠️  No tokens in contract!");
    return;
  }

  // Check pending amounts and claim for each payee
  console.log("Claiming tokens individually for each payee...\n");
  let totalClaimed = BigInt(0);

  for (let i = 0; i < PAYEES.length; i++) {
    const payee = PAYEES[i];
    
    try {
      const pending = await splitter.pendingToken(token, payee);
      const balanceBefore = await token.balanceOf(payee);
      
      console.log(`Payee ${i + 1}/${PAYEES.length}: ${payee}`);
      console.log(`  Pending: ${ethers.formatUnits(pending, tokenDecimals)} ${tokenSymbol}`);
      
      if (pending > 0) {
        const tx = await splitter.claim(token, payee);
        console.log(`  Transaction hash: ${tx.hash}`);
        
        console.log("  Waiting for confirmation...");
        const receipt = await tx.wait();
        console.log(`  ✅ Confirmed in block: ${receipt?.blockNumber}`);

        const balanceAfter = await token.balanceOf(payee);
        const claimed = balanceAfter - balanceBefore;
        totalClaimed += claimed;
        
        console.log(`  Claimed: ${ethers.formatUnits(claimed, tokenDecimals)} ${tokenSymbol}\n`);
      } else {
        console.log("  ⚠️  Nothing pending, skipping...\n");
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message || error}`);
      if (error.reason) {
        console.log(`  Reason: ${error.reason}`);
      }
      console.log();
    }
  }

  console.log("=".repeat(80));
  console.log(`✅ Total claimed: ${ethers.formatUnits(totalClaimed, tokenDecimals)} ${tokenSymbol}`);
  console.log("=".repeat(80));
}

// Only execute if run directly (not during tests)
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

