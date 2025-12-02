import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitterV2, ERC20Mock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitterV2 - Payee Removal Accounting", function () {
  let splitter: ERC20FeeSplitterV2;
  let token: ERC20Mock;
  let owner: HardhatEthersSigner;
  let payee1: HardhatEthersSigner;
  let payee2: HardhatEthersSigner;
  let removedPayee: HardhatEthersSigner;

  const PAYEE1_ADDRESS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
  const PAYEE2_ADDRESS = "0x057fd8B961Eb664baA647a5C7A6e9728fabA266A";
  const REMOVED_PAYEE_ADDRESS = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";

  beforeEach(async function () {
    [owner, payee1, payee2, removedPayee] = await ethers.getSigners();

    const ERC20FeeSplitterV2Factory = await ethers.getContractFactory("ERC20FeeSplitterV2");
    splitter = (await ERC20FeeSplitterV2Factory.deploy(
      [PAYEE1_ADDRESS, PAYEE2_ADDRESS, REMOVED_PAYEE_ADDRESS],
      [3, 7, 3],
      [owner.address],
    )) as ERC20FeeSplitterV2;
    await splitter.waitForDeployment();

    const TokenFactory = await ethers.getContractFactory(
      "contracts/ERC20FeeSplitter-V2/mocks/ERC20Mock.sol:ERC20Mock",
    );
    token = (await TokenFactory.deploy("Test Token", "TEST", 18)) as ERC20Mock;
    await token.waitForDeployment();

    await splitter.addClaimableToken(await token.getAddress());
  });

  it("should exclude removed payee released amounts from future pending calculations", async function () {
    const amount = ethers.parseEther("1000");
    await token.mint(owner.address, amount);
    await token.transfer(await splitter.getAddress(), amount);

    // Removed payee claims their share first (registers token tracking)
    await splitter.claim(token, REMOVED_PAYEE_ADDRESS);
    const balanceAfterRemovalClaim = await token.balanceOf(await splitter.getAddress());

    await splitter.removePayee(REMOVED_PAYEE_ADDRESS);
    expect(await splitter.getPayeeCount()).to.equal(2);
    expect(await splitter.totalShares()).to.equal(10); // 3 + 7

    const payee1Pending = await splitter.pendingToken(token, PAYEE1_ADDRESS);
    const payee2Pending = await splitter.pendingToken(token, PAYEE2_ADDRESS);

    // Remaining payees should split the remaining balance proportionally (within rounding tolerance)
    expect(payee1Pending + payee2Pending).to.be.closeTo(
      balanceAfterRemovalClaim,
      ethers.parseEther("0.0000000000000001"),
    );

    const payee1BalanceBefore = await token.balanceOf(PAYEE1_ADDRESS);
    const payee2BalanceBefore = await token.balanceOf(PAYEE2_ADDRESS);

    await splitter.claim(token, PAYEE1_ADDRESS);
    await splitter.claim(token, PAYEE2_ADDRESS);

    const payee1Claimed = (await token.balanceOf(PAYEE1_ADDRESS)) - payee1BalanceBefore;
    const payee2Claimed = (await token.balanceOf(PAYEE2_ADDRESS)) - payee2BalanceBefore;

    expect(payee1Claimed + payee2Claimed).to.be.closeTo(
      balanceAfterRemovalClaim,
      ethers.parseEther("0.0000000000000001"),
    );
    expect(await token.balanceOf(await splitter.getAddress())).to.be.lt(
      ethers.parseEther("0.0000000000000001"),
    );
  });

  it("should allow claimAll after removing a payee who previously claimed", async function () {
    const amount = ethers.parseEther("500");
    await token.mint(owner.address, amount);
    await token.transfer(await splitter.getAddress(), amount);

    // Removed payee claims first to simulate prior payouts
    await splitter.claim(token, REMOVED_PAYEE_ADDRESS);

    await splitter.removePayee(REMOVED_PAYEE_ADDRESS);

    await expect(splitter.claimAll()).to.not.be.reverted;

    expect(await token.balanceOf(PAYEE1_ADDRESS)).to.be.gt(0);
    expect(await token.balanceOf(PAYEE2_ADDRESS)).to.be.gt(0);
  });
});

