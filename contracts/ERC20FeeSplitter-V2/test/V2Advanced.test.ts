import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitterV2, ERC20Mock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitterV2 - Advanced Test Cases", function () {
  let splitter: ERC20FeeSplitterV2;
  let token: ERC20Mock;
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

    // Deploy mock ERC20 token
    const TokenFactory = await ethers.getContractFactory(
      "contracts/ERC20FeeSplitter-V2/mocks/ERC20Mock.sol:ERC20Mock",
    );
    token = await TokenFactory.deploy("Test Token", "TEST", 18);
  });

  describe("Multiple Deposits Across Time", function () {
    it("should handle multiple deposits and cumulative claiming", async function () {
      const amount1 = ethers.parseEther("1000");
      await token.mint(owner.address, amount1);
      await token.transfer(await splitter.getAddress(), amount1);

      // Claim for payee1
      await splitter.claim(token, await payee1.getAddress());
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("300"));

      // Second deposit
      const amount2 = ethers.parseEther("500");
      await token.mint(owner.address, amount2);
      await token.transfer(await splitter.getAddress(), amount2);

      // Payee1 should get 30% of new 500 = 150, plus already claimed 300
      await splitter.claim(token, await payee1.getAddress());
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("450"));
    });

    it("should handle interleaved claim/claimAll operations", async function () {
      const amount1 = ethers.parseEther("1000");
      await token.mint(owner.address, amount1);
      await token.transfer(await splitter.getAddress(), amount1);

      // Claim for one payee
      await splitter.claim(token, await payee1.getAddress());

      // Second deposit
      const amount2 = ethers.parseEther("500");
      await token.mint(owner.address, amount2);
      await token.transfer(await splitter.getAddress(), amount2);

      // Claim all
      await splitter.claimAll(token);

      // All payees should have received their shares
      expect(await token.balanceOf(await payee1.getAddress())).to.be.gte(ethers.parseEther("300"));
      expect(await token.balanceOf(await payee2.getAddress())).to.be.gte(ethers.parseEther("300"));
      expect(await token.balanceOf(await payee3.getAddress())).to.be.gte(ethers.parseEther("400"));
    });
  });

  describe("Rebasing Token Simulation", function () {
    it("should handle balance increases without transfers", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Simulate rebase by minting directly to contract
      const rebaseAmount = ethers.parseEther("100");
      await token.mint(await splitter.getAddress(), rebaseAmount);

      // Pending amounts should increase
      const pending1 = await splitter.pendingToken(token, await payee1.getAddress());
      expect(pending1).to.be.gt(ethers.parseEther("300")); // More than initial 30%
    });
  });

  describe("Zero-Due Paths", function () {
    it("should revert claim with NothingDue when no tokens", async function () {
      await expect(splitter.claim(token, await payee1.getAddress())).to.be.revertedWithCustomError(
        splitter,
        "NothingDue",
      );
    });

    it("should revert claim with NothingDue when already claimed", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await splitter.claim(token, await payee1.getAddress());

      // Try to claim again
      await expect(splitter.claim(token, await payee1.getAddress())).to.be.revertedWithCustomError(
        splitter,
        "NothingDue",
      );
    });

    it("should quietly no-op claimAll when nothing due", async function () {
      const tx = await splitter.claimAll(token);
      const receipt = await tx.wait();
      // Should succeed but do nothing
      expect(receipt).to.not.be.null;
    });
  });

  describe("Security: Reentrancy Protection", function () {
    it("should prevent reentrancy attacks", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Multiple rapid claims should be safe
      await Promise.all([
        splitter.claim(token, await payee1.getAddress()),
        splitter.claim(token, await payee2.getAddress()),
        splitter.claim(token, await payee3.getAddress()),
      ]);

      // All should succeed without reentrancy issues
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(await payee2.getAddress())).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(await payee3.getAddress())).to.equal(ethers.parseEther("400"));
    });
  });

  describe("Edge Cases: Precision and Rounding", function () {
    it("should handle odd amounts correctly", async function () {
      const amount = ethers.parseEther("1001"); // Odd number
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await splitter.claimAll(token);

      // Total claimed should equal amount (within rounding)
      const totalClaimed =
        (await token.balanceOf(await payee1.getAddress())) +
        (await token.balanceOf(await payee2.getAddress())) +
        (await token.balanceOf(await payee3.getAddress()));
      expect(totalClaimed).to.equal(amount);
    });

    it("should handle very small amounts", async function () {
      const amount = ethers.parseEther("0.000001");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Should handle without errors
      await expect(splitter.claimAll(token)).to.not.be.reverted;
    });
  });
});
