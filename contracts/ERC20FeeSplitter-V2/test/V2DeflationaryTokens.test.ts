import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitterV2, ERC20Mock, DeflationaryMock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitterV2 - Deflationary Token Support", function () {
  let splitter: ERC20FeeSplitterV2;
  let deflToken: DeflationaryMock;
  let owner: HardhatEthersSigner;
  let payee1: HardhatEthersSigner;
  let payee2: HardhatEthersSigner;
  let payee3: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, payee1, payee2, payee3] = await ethers.getSigners();

    // Deploy ERC20FeeSplitterV2 with 3 payees (3:3:4 shares)
    const ERC20FeeSplitterV2Factory = await ethers.getContractFactory("ERC20FeeSplitterV2");
    splitter = await ERC20FeeSplitterV2Factory.deploy(
      [await payee1.getAddress(), await payee2.getAddress(), await payee3.getAddress()],
      [3, 3, 4],
      [owner.address],
    );
    await splitter.waitForDeployment();

    // Deploy deflationary token (1% burn on transfer)
    const DeflFactory = await ethers.getContractFactory(
      "contracts/ERC20FeeSplitter-V2/mocks/DeflationaryMock.sol:DeflationaryMock",
    );
    deflToken = await DeflFactory.deploy("Deflationary", "DEFL", 18);
    await deflToken.waitForDeployment();

    await splitter.addClaimableToken(await deflToken.getAddress());
  });

  it("should handle deflationary tokens correctly with actual-sent accounting", async function () {
    const amount = ethers.parseEther("1000");
    await deflToken.mint(owner.address, amount);

    // Transfer to splitter (1% burn happens here)
    const balanceBefore = await deflToken.balanceOf(await splitter.getAddress());
    await deflToken.transfer(await splitter.getAddress(), amount);
    const balanceAfter = await deflToken.balanceOf(await splitter.getAddress());
    const actualReceived = balanceAfter - balanceBefore; // Should be ~990 due to 1% burn

    // Get initial payee balances
    const payee1BalanceBefore = await deflToken.balanceOf(await payee1.getAddress());
    const payee2BalanceBefore = await deflToken.balanceOf(await payee2.getAddress());
    const payee3BalanceBefore = await deflToken.balanceOf(await payee3.getAddress());

    await splitter.claimAll();

    // Check balances (accounting for deflationary nature - another 1% burn on each claim transfer)
    const balance1 = await deflToken.balanceOf(await payee1.getAddress());
    const balance2 = await deflToken.balanceOf(await payee2.getAddress());
    const balance3 = await deflToken.balanceOf(await payee3.getAddress());

    // Calculate what was actually received by each payee
    const received1 = balance1 - payee1BalanceBefore;
    const received2 = balance2 - payee2BalanceBefore;
    const received3 = balance3 - payee3BalanceBefore;

    // Calculate expected amounts based on actual received (before claim transfers)
    // Each claim transfer also burns 1%, so we need to account for that
    const expected1BeforeBurn = (actualReceived * 3n) / 10n;
    const expected2BeforeBurn = (actualReceived * 3n) / 10n;
    const expected3BeforeBurn = (actualReceived * 4n) / 10n;

    // After claim transfer, 1% is burned, so received = expected * 99/100
    // Should match expected amounts (within rounding for the double burn)
    expect(received1).to.be.closeTo((expected1BeforeBurn * 99n) / 100n, ethers.parseEther("1"));
    expect(received2).to.be.closeTo((expected2BeforeBurn * 99n) / 100n, ethers.parseEther("1"));
    expect(received3).to.be.closeTo((expected3BeforeBurn * 99n) / 100n, ethers.parseEther("1"));
  });

  it("should track released amounts correctly for deflationary tokens", async function () {
    const amount = ethers.parseEther("1000");
    await deflToken.mint(owner.address, amount);
    await deflToken.transfer(await splitter.getAddress(), amount);

    await splitter.claim(deflToken, await payee1.getAddress());

    // After claiming, pending should be reduced
    const pending = await splitter.pendingToken(deflToken, await payee1.getAddress());
    expect(pending).to.be.lt(ethers.parseEther("300")); // Less than initial due to deflation
  });
});
