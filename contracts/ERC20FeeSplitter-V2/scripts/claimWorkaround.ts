import { ethers } from "hardhat";

/**
 * Workaround script to claim tokens individually after a payee has been removed
 * 
 * This script claims tokens for each payee individually instead of using claimAll(),
 * which works around the accounting bug where removed payees' released amounts
 * are still included in _totalReleasedERC20 calculations.
 *
 * Usage:
 *   npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/claimWorkaround.ts --network base
 * 
 * Make sure PRIVATE_KEY is set in .env file
 */
async function main() {
  // Contract address (deployed on Base)
  const CONTRACT_ADDRESS = "0x3690Eb8735fE51c695d2f2Da289D1FA447137E24";
  
  // Tokens to claim
  const TOKENS = [
    "0xAeCc8113a7bD0CFAF7000EA7A31afFD4691ff3E9",
    "0x21e0d366272798da3A977FEBA699FCB91959d120",
    "0xf7e26Fa48A568b8b0038e104DfD8ABdf0f99074F",
  ];

  // Remaining payees (after removing 0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333)
  const PAYEES = [
    "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261",
    "0x057fd8B961Eb664baA647a5C7A6e9728fabA266A",
  ];

  const [signer] = await ethers.getSigners();
  
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Please set PRIVATE_KEY in .env file");
  }

  console.log("=".repeat(80));
  console.log("Claim Workaround Script - Individual Claims After Payee Removal");
  console.log("=".repeat(80));
  console.log("Account:", signer.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log(`\nTokens to claim: ${TOKENS.length}`);
  console.log(`Payees: ${PAYEES.length}`);
  console.log("Removed payee: 0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333");
  console.log("\n" + "=".repeat(80) + "\n");

  // Get contract instance
  const splitter = await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  );

  // Verify current payees in contract
  const contractPayees = await splitter.getAllPayees();
  console.log("Current payees in contract:");
  for (let i = 0; i < contractPayees.length; i++) {
    const info = await splitter.getPayeeInfo(contractPayees[i]);
    console.log(`  ${i + 1}. ${contractPayees[i]} (${info.shares} shares)`);
  }
  console.log();

  // Process each token
  for (let tokenIdx = 0; tokenIdx < TOKENS.length; tokenIdx++) {
    const tokenAddress = TOKENS[tokenIdx];
    console.log("=".repeat(80));
    console.log(`Token ${tokenIdx + 1}/${TOKENS.length}: ${tokenAddress}`);
    console.log("=".repeat(80));

    // Get token instance
    const token = await ethers.getContractAt("IERC20", tokenAddress);

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
      console.log("⚠️  No tokens in contract, skipping...\n");
      continue;
    }

    // Check pending amounts for each payee
    console.log("Checking pending amounts:");
    const payeeInfo: Array<{ address: string; pending: bigint; balanceBefore: bigint }> = [];
    let totalPending = BigInt(0);

    for (const payee of PAYEES) {
      try {
        const pending = await splitter.pendingToken(token, payee);
        const balanceBefore = await token.balanceOf(payee);
        payeeInfo.push({ address: payee, pending, balanceBefore });
        totalPending += pending;
        console.log(
          `  ${payee}: ${ethers.formatUnits(pending, tokenDecimals)} ${tokenSymbol} (pending)`,
        );
      } catch (error: any) {
        console.log(`  ${payee}: Error checking pending - ${error.message}`);
      }
    }

    console.log(`\nTotal pending: ${ethers.formatUnits(totalPending, tokenDecimals)} ${tokenSymbol}\n`);

    if (totalPending === BigInt(0)) {
      console.log("⚠️  No tokens to claim for this token, skipping...\n");
      continue;
    }

    // Claim individually for each payee (workaround for accounting bug)
    console.log("Claiming tokens individually for each payee...\n");
    let totalClaimed = BigInt(0);

    for (let i = 0; i < payeeInfo.length; i++) {
      const info = payeeInfo[i];
      
      if (info.pending > 0) {
        try {
          console.log(`  Claiming for payee ${i + 1}/${payeeInfo.length}: ${info.address}...`);
          console.log(`    Pending: ${ethers.formatUnits(info.pending, tokenDecimals)} ${tokenSymbol}`);
          
          const tx = await splitter.claim(token, info.address);
          console.log(`    Transaction hash: ${tx.hash}`);
          
          console.log("    Waiting for confirmation...");
          const receipt = await tx.wait();
          console.log(`    ✅ Confirmed in block: ${receipt?.blockNumber}`);

          const balanceAfter = await token.balanceOf(info.address);
          const claimed = balanceAfter - info.balanceBefore;
          totalClaimed += claimed;
          
          console.log(
            `    Claimed: ${ethers.formatUnits(claimed, tokenDecimals)} ${tokenSymbol}\n`,
          );
        } catch (error: any) {
          console.log(`    ❌ Failed to claim: ${error.message || error}`);
          if (error.reason) {
            console.log(`    Reason: ${error.reason}`);
          }
          if (error.data) {
            console.log(`    Error data: ${error.data}`);
            // Try to decode common errors
            try {
              const errorInterface = new ethers.Interface([
                "error NothingDue()",
                "error TokenTransferFailed()",
                "error PayeeNotFound()",
              ]);
              const decoded = errorInterface.parseError(error.data);
              if (decoded) {
                console.log(`    Decoded error: ${decoded.name}`);
              }
            } catch {
              // Couldn't decode
            }
          }
          console.log(`    ⚠️  This might be due to the accounting bug - pending amount may be inflated`);
          console.log(`    Try checking the actual claimable amount manually`);
          console.log();
        }
      } else {
        console.log(`  Skipping payee ${i + 1}/${payeeInfo.length}: ${info.address} (nothing pending)\n`);
      }
    }

    console.log(`✅ Total claimed for ${tokenSymbol}: ${ethers.formatUnits(totalClaimed, tokenDecimals)} ${tokenSymbol}\n`);
  }

  console.log("=".repeat(80));
  console.log("✅ All tokens processed!");
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

