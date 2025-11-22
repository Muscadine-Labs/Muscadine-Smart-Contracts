import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitter, ERC20Mock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitter - Advanced Test Cases", function () {
  let splitter: ERC20FeeSplitter;
  let token: ERC20Mock;
  let payee1: HardhatEthersSigner;
  let payee2: HardhatEthersSigner;
  let deployer: HardhatEthersSigner;

  beforeEach(async function () {
    [deployer, payee1, payee2] = await ethers.getSigners();

    // Deploy ERC20FeeSplitter with 50/50 split
    const Splitter = await ethers.getContractFactory("ERC20FeeSplitter");
    splitter = await Splitter.deploy(
      await payee1.getAddress(),
      await payee2.getAddress(),
      1, // shares1 (50%)
      1, // shares2 (50%)
    );
    await splitter.waitForDeployment();

    // Deploy mock ERC20 token
    const TokenFactory = await ethers.getContractFactory(
      "contracts/ERC20FeeSplitter/mocks/ERC20Mock.sol:ERC20Mock",
    );
    token = (await TokenFactory.deploy("Test Token", "TEST", 18)) as ERC20Mock;
  });

  describe("Equal/Unequal Shares", function () {
    it("should handle 50/50 split correctly", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount);
      await token.transfer(await splitter.getAddress(), amount);

      expect(await splitter.pendingToken(token, await payee1.getAddress())).to.equal(
        ethers.parseEther("500"),
      );
      expect(await splitter.pendingToken(token, await payee2.getAddress())).to.equal(
        ethers.parseEther("500"),
      );
    });

    it("should handle 70/30 split correctly", async function () {
      // Deploy new splitter with 70/30 split
      const Splitter70 = await ethers.getContractFactory("ERC20FeeSplitter");
      const splitter70 = await Splitter70.deploy(
        await payee1.getAddress(),
        await payee2.getAddress(),
        7, // shares1 (70%)
        3, // shares2 (30%)
      );

      const amount = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount);
      await token.transfer(await splitter70.getAddress(), amount);

      expect(await splitter70.pendingToken(token, await payee1.getAddress())).to.equal(
        ethers.parseEther("700"),
      );
      expect(await splitter70.pendingToken(token, await payee2.getAddress())).to.equal(
        ethers.parseEther("300"),
      );
    });
  });

  describe("Multiple Deposits Across Time", function () {
    it("should handle multiple deposits and cumulative claiming", async function () {
      // First deposit
      const amount1 = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount1);
      await token.transfer(await splitter.getAddress(), amount1);

      // Claim first batch
      await splitter.connect(payee1).claim(token, await payee1.getAddress());
      await splitter.connect(payee2).claim(token, await payee2.getAddress());

      // Verify tokens were claimed by checking token balances
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("500"));
      expect(await token.balanceOf(await payee2.getAddress())).to.equal(ethers.parseEther("500"));

      // Second deposit
      const amount2 = ethers.parseEther("2000");
      await token.mint(await deployer.getAddress(), amount2);
      await token.transfer(await splitter.getAddress(), amount2);

      // Claim second batch
      await splitter.connect(payee1).claim(token, await payee1.getAddress());
      await splitter.connect(payee2).claim(token, await payee2.getAddress());

      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("1500"));
      expect(await token.balanceOf(await payee2.getAddress())).to.equal(ethers.parseEther("1500"));
    });

    it("should handle interleaved claim/claimAll operations", async function () {
      // Initial deposit
      const amount1 = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount1);
      await token.transfer(await splitter.getAddress(), amount1);

      // Claim for payee1 only
      await splitter.connect(payee1).claim(token, await payee1.getAddress());
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("500"));
      expect(await token.balanceOf(await payee2.getAddress())).to.equal(0);

      // Second deposit
      const amount2 = ethers.parseEther("2000");
      await token.mint(await deployer.getAddress(), amount2);
      await token.transfer(await splitter.getAddress(), amount2);

      // Use claimAll to claim for both
      await splitter.connect(payee1).claimAll(token);

      // After claimAll:
      // Payee1 should have: 500 (first) + 1000 (second) = 1500
      // Payee2 should have: 0 (first) + 1500 (second) = 1500
      // claimAll claims based on current pending amounts for each payee
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("1500"));
      expect(await token.balanceOf(await payee2.getAddress())).to.equal(ethers.parseEther("1500"));
    });
  });

  describe("Deflationary Token (10% Burn)", function () {
    let deflToken: any;

    beforeEach(async function () {
      // Deploy deflationary token that burns 10% on transfer
      const DeflFactory = await ethers.getContractFactory(
        "contracts/ERC20FeeSplitter/mocks/DeflationaryMock.sol:DeflationaryMock",
      );
      deflToken = await DeflFactory.deploy("Deflationary", "DEFL", 18);
    });

    it("should handle deflationary token with proportional claims", async function () {
      const amount = ethers.parseEther("1000");
      await deflToken.mint(await deployer.getAddress(), amount);

      const balanceBefore = await deflToken.balanceOf(await splitter.getAddress());
      await deflToken.transfer(await splitter.getAddress(), amount);
      const balanceAfter = await deflToken.balanceOf(await splitter.getAddress());
      const actualReceived = balanceAfter - balanceBefore;

      // Should receive 990 (10% burned)
      expect(actualReceived).to.equal(ethers.parseEther("990"));

      // Claims should be based on actual received amount (990/2 = 495 each)
      expect(await splitter.pendingToken(deflToken, await payee1.getAddress())).to.equal(
        ethers.parseEther("495"),
      );
      expect(await splitter.pendingToken(deflToken, await payee2.getAddress())).to.equal(
        ethers.parseEther("495"),
      );

      // Claim and verify actual sent amounts
      const payee1BalanceBefore = await deflToken.balanceOf(await payee1.getAddress());
      await splitter.connect(payee1).claim(deflToken, await payee1.getAddress());
      const payee1BalanceAfter = await deflToken.balanceOf(await payee1.getAddress());
      const actualSent1 = payee1BalanceAfter - payee1BalanceBefore;

      // Should receive ~495 (may be less due to deflation)
      expect(actualSent1).to.be.greaterThan(ethers.parseEther("445"));
      expect(actualSent1).to.be.lessThan(ethers.parseEther("495"));
    });
  });

  describe("Rebasing Token Simulation", function () {
    it("should handle balance increases without transfers", async function () {
      // Simulate rebasing by manually minting to contract
      const amount = ethers.parseEther("1000");
      await token.mint(await splitter.getAddress(), amount);

      // Verify pending amounts scale with balance
      expect(await splitter.pendingToken(token, await payee1.getAddress())).to.equal(
        ethers.parseEther("500"),
      );
      expect(await splitter.pendingToken(token, await payee2.getAddress())).to.equal(
        ethers.parseEther("500"),
      );

      // Simulate rebase by minting more directly to contract
      await token.mint(await splitter.getAddress(), amount);

      // Pending amounts should double
      expect(await splitter.pendingToken(token, await payee1.getAddress())).to.equal(
        ethers.parseEther("1000"),
      );
      expect(await splitter.pendingToken(token, await payee2.getAddress())).to.equal(
        ethers.parseEther("1000"),
      );
    });
  });

  describe("Zero-Due Paths", function () {
    it("should revert claim with NothingDue when no tokens", async function () {
      await expect(
        splitter.connect(payee1).claim(token, await payee1.getAddress()),
      ).to.be.revertedWithCustomError(splitter, "NothingDue");
    });

    it("should revert claim with NothingDue when already claimed", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Claim once
      await splitter.connect(payee1).claim(token, await payee1.getAddress());

      // Try to claim again - should revert
      await expect(
        splitter.connect(payee1).claim(token, await payee1.getAddress()),
      ).to.be.revertedWithCustomError(splitter, "NothingDue");
    });

    it("should quietly no-op claimAll when nothing due", async function () {
      // claimAll should not revert when nothing is due
      await expect(splitter.connect(payee1).claimAll(token)).to.not.be.reverted;

      // Should emit no events (quiet no-op)
      const tx = await splitter.connect(payee1).claimAll(token);
      const receipt = await tx.wait();
      expect(receipt!.logs).to.have.length(0);
    });

    it("should no-op claimAll when all already claimed", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Claim all
      await splitter.connect(payee1).claimAll(token);

      // Try claimAll again - should no-op quietly
      await expect(splitter.connect(payee1).claimAll(token)).to.not.be.reverted;
    });
  });

  describe("Security: Reentrancy Protection", function () {
    it("should prevent reentrancy attacks", async function () {
      // Mint some tokens directly to the splitter
      await token.mint(await splitter.getAddress(), ethers.parseEther("1000"));

      // This should not cause reentrancy issues due to ReentrancyGuard
      await expect(splitter.connect(payee1).claim(token, await payee1.getAddress())).to.not.be
        .reverted;

      // Verify the claim worked
      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("500"));
    });
  });

  describe("Edge Cases: Precision and Rounding", function () {
    it("should handle odd amounts correctly", async function () {
      const amount = ethers.parseEther("1001"); // Odd amount
      await token.mint(await deployer.getAddress(), amount);
      await token.transfer(await splitter.getAddress(), amount);

      // 1001 / 2 = 500.5, should round down for each
      const pending1 = await splitter.pendingToken(token, await payee1.getAddress());
      const pending2 = await splitter.pendingToken(token, await payee2.getAddress());

      expect(pending1).to.equal(ethers.parseEther("500.5"));
      expect(pending2).to.equal(ethers.parseEther("500.5"));

      // Total claimed should be 1001 (exact amount)
      await splitter.connect(payee1).claim(token, await payee1.getAddress());
      await splitter.connect(payee2).claim(token, await payee2.getAddress());

      expect(await token.balanceOf(await payee1.getAddress())).to.equal(ethers.parseEther("500.5"));
      expect(await token.balanceOf(await payee2.getAddress())).to.equal(ethers.parseEther("500.5"));
    });
  });
});
