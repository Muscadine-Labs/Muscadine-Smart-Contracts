import { ethers } from "hardhat";
import { ERC20FeeSplitterV2 } from "../../../../typechain-types";

type Action = "list" | "add" | "remove";

/**
 * Manage claimable token list for ERC20FeeSplitterV2.
 *
 * Usage examples:
 *   CONTRACT_ADDRESS=0x... ACTION=list npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/manageClaimableTokens.ts --network base
 *   CONTRACT_ADDRESS=0x... ACTION=add TOKEN_ADDRESS=0x... npx hardhat run ...
 *   CONTRACT_ADDRESS=0x... ACTION=remove TOKEN_ADDRESS=0x... npx hardhat run ...
 */
async function main() {
  const [caller] = await ethers.getSigners();

  const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
  const ACTION = (process.env.ACTION || "list").toLowerCase() as Action;
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;

  if (!CONTRACT_ADDRESS) {
    throw new Error("Please set CONTRACT_ADDRESS in your environment");
  }
  if (!["list", "add", "remove"].includes(ACTION)) {
    throw new Error('ACTION must be "list", "add", or "remove"');
  }

  const splitter = (await ethers.getContractAt(
    "ERC20FeeSplitterV2",
    CONTRACT_ADDRESS,
  )) as ERC20FeeSplitterV2;

  const isOwner = await splitter.isOwner(caller.address);
  if (ACTION !== "list" && !isOwner) {
    const owners = await splitter.getAllOwners();
    throw new Error(`Only owners can add or remove claimable tokens. Owners: ${owners.join(", ")}`);
  }

  console.log("Managing claimable tokens with account:", caller.address);
  console.log("Contract address:", CONTRACT_ADDRESS);
  console.log("Action:", ACTION);

  const currentTokens = await splitter.getClaimableTokens();

  const logTokenList = async (label: string) => {
    const tokens = await splitter.getClaimableTokens();
    console.log(`\n${label}: ${tokens.length} token(s)`);
    tokens.forEach((token, index) => {
      console.log(`  ${index + 1}. ${token}`);
    });
  };

  if (ACTION === "list") {
    await logTokenList("Current claimable tokens");
    return;
  }

  if (!TOKEN_ADDRESS) {
    throw new Error("Please set TOKEN_ADDRESS in your environment");
  }

  if (ACTION === "add") {
    if (currentTokens.includes(TOKEN_ADDRESS)) {
      throw new Error("Token already exists in claimable list");
    }

    console.log("\n=== Adding Claimable Token ===");
    console.log("Token:", TOKEN_ADDRESS);

    const tx = await splitter.addClaimableToken(TOKEN_ADDRESS);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt?.blockNumber);

    await logTokenList("Updated claimable tokens");
  } else if (ACTION === "remove") {
    if (!currentTokens.includes(TOKEN_ADDRESS)) {
      throw new Error("Token not found in claimable list");
    }

    console.log("\n=== Removing Claimable Token ===");
    console.log("Token:", TOKEN_ADDRESS);

    const tx = await splitter.removeClaimableToken(TOKEN_ADDRESS);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt?.blockNumber);

    await logTokenList("Updated claimable tokens");
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
