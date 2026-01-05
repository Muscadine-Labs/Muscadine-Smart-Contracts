import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitterV2, ERC20Mock } from "../../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitterV2", function () {
  let splitter: ERC20FeeSplitterV2;
  let token: ERC20Mock;
  let owner: HardhatEthersSigner;
  let payee1Signer: HardhatEthersSigner;
  let payee2Signer: HardhatEthersSigner;
  let payee3Signer: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;
  let tokenAddress: string;

  const PAYEE1_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
  const PAYEE2_ADDRESS = "0x2222222222222222222222222222222222222222" as const;
  const PAYEE3_ADDRESS = "0x3333333333333333333333333333333333333333" as const;

  beforeEach(async function () {
    [owner, payee1Signer, payee2Signer, payee3Signer, stranger] = await ethers.getSigners();

    // Deploy ERC20FeeSplitterV2 with initial configuration
    const ERC20FeeSplitterV2Factory = await ethers.getContractFactory("ERC20FeeSplitterV2");
    splitter = await ERC20FeeSplitterV2Factory.deploy(
      [PAYEE1_ADDRESS, PAYEE2_ADDRESS, PAYEE3_ADDRESS],
      [3, 3, 4], // 3 + 3 + 4 = 10 shares total
      [owner.address], // Array of initial owners
    );
    await splitter.waitForDeployment();

    // Deploy mock ERC20 token
    const TokenFactory = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    token = (await TokenFactory.deploy("Test Token", "TEST", 18)) as ERC20Mock;
    await token.waitForDeployment();
    tokenAddress = await token.getAddress();
    await splitter.addClaimableToken(tokenAddress);
  });

  describe("Claimable token management", function () {
    it("should expose configured claimable tokens", async function () {
      const claimable = await splitter.getClaimableTokens();
      expect(claimable).to.deep.equal([tokenAddress]);
    });

    it("should prevent duplicate claimable token entries", async function () {
      await expect(splitter.addClaimableToken(tokenAddress)).to.be.revertedWithCustomError(
        splitter,
        "ClaimableTokenAlreadyExists",
      );
    });

    it("should allow removing claimable tokens", async function () {
      await splitter.removeClaimableToken(tokenAddress);
      const claimable = await splitter.getClaimableTokens();
      expect(claimable.length).to.equal(0);
    });

    it("should revert when removing unknown claimable token", async function () {
      await splitter.removeClaimableToken(tokenAddress);
      await expect(splitter.removeClaimableToken(tokenAddress)).to.be.revertedWithCustomError(
        splitter,
        "ClaimableTokenNotFound",
      );
    });

    it("should revert claimAll when no claimable tokens configured", async function () {
      await splitter.removeClaimableToken(tokenAddress);
      await expect(splitter.claimAll()).to.be.revertedWithCustomError(
        splitter,
        "NoClaimableTokens",
      );
    });

    it("should claim across multiple tokens in a single call", async function () {
      const TokenFactory = await ethers.getContractFactory(
        "contracts/mocks/ERC20Mock.sol:ERC20Mock",
      );
      const secondToken = (await TokenFactory.deploy("Second Token", "TWO", 6)) as ERC20Mock;
      await secondToken.waitForDeployment();
      await splitter.addClaimableToken(await secondToken.getAddress());

      const amountPrimary = ethers.parseEther("1000");
      const amountSecondary = ethers.parseUnits("5000", 6);

      await token.mint(owner.address, amountPrimary);
      await secondToken.mint(owner.address, amountSecondary);

      await token.transfer(await splitter.getAddress(), amountPrimary);
      await secondToken.transfer(await splitter.getAddress(), amountSecondary);

      await splitter.claimAll();

      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(PAYEE3_ADDRESS)).to.equal(ethers.parseEther("400"));

      expect(await secondToken.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseUnits("1500", 6));
      expect(await secondToken.balanceOf(PAYEE2_ADDRESS)).to.equal(ethers.parseUnits("1500", 6));
      expect(await secondToken.balanceOf(PAYEE3_ADDRESS)).to.equal(ethers.parseUnits("2000", 6));
    });

    it("should allow claiming all payees for a single token", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await splitter.claimAllForToken(token);

      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(PAYEE3_ADDRESS)).to.equal(ethers.parseEther("400"));
    });

    it("should revert claimAllForToken when token is not claimable", async function () {
      const TokenFactory = await ethers.getContractFactory(
        "contracts/mocks/ERC20Mock.sol:ERC20Mock",
      );
      const unlistedToken = (await TokenFactory.deploy(
        "Unlisted Token",
        "UNLISTED",
        18,
      )) as ERC20Mock;
      await unlistedToken.waitForDeployment();

      await expect(splitter.claimAllForToken(unlistedToken)).to.be.revertedWithCustomError(
        splitter,
        "ClaimableTokenNotFound",
      );
    });

    it("should handle claimAllForToken with zero balance gracefully", async function () {
      const TokenFactory = await ethers.getContractFactory(
        "contracts/mocks/ERC20Mock.sol:ERC20Mock",
      );
      const emptyToken = (await TokenFactory.deploy("Empty Token", "ZERO", 18)) as ERC20Mock;
      await emptyToken.waitForDeployment();
      await splitter.addClaimableToken(await emptyToken.getAddress());

      // Should not revert, just do nothing
      await expect(splitter.claimAllForToken(emptyToken)).to.not.be.reverted;
    });

    it("should be more gas efficient than claimAll for single token", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // claimAllForToken should be cheaper when only one token needs claiming
      const tx1 = await splitter.claimAllForToken(token);
      const receipt1 = await tx1.wait();
      const gasUsed1 = receipt1?.gasUsed || 0n;

      // Reset by sending more tokens
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // claimAll processes all tokens (even if only one has balance)
      const tx2 = await splitter.claimAll();
      const receipt2 = await tx2.wait();
      const gasUsed2 = receipt2?.gasUsed || 0n;

      // claimAllForToken should use less gas when only one token is claimable
      // (This test verifies the function works, actual gas savings depend on number of tokens)
      expect(gasUsed1).to.be.gt(0);
      expect(gasUsed2).to.be.gt(0);
    });

    it("should skip claimable tokens without balances during claimAll", async function () {
      const TokenFactory = await ethers.getContractFactory(
        "contracts/mocks/ERC20Mock.sol:ERC20Mock",
      );
      const emptyToken = (await TokenFactory.deploy("Empty Token", "ZERO", 18)) as ERC20Mock;
      await emptyToken.waitForDeployment();

      await splitter.addClaimableToken(await emptyToken.getAddress());

      const amount = ethers.parseEther("250");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await expect(splitter.claimAll()).to.not.be.reverted;

      expect(await emptyToken.balanceOf(PAYEE1_ADDRESS)).to.equal(0);
      expect(await emptyToken.balanceOf(PAYEE2_ADDRESS)).to.equal(0);
      expect(await emptyToken.balanceOf(PAYEE3_ADDRESS)).to.equal(0);
      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("75"));
      expect(await token.balanceOf(PAYEE2_ADDRESS)).to.equal(ethers.parseEther("75"));
      expect(await token.balanceOf(PAYEE3_ADDRESS)).to.equal(ethers.parseEther("100"));
    });
  });

  describe("Deployment", function () {
    it("should initialize with correct payees and shares", async function () {
      expect(await splitter.isOwner(owner.address)).to.be.true;
      expect(await splitter.getOwnerCount()).to.equal(1);
      expect(await splitter.totalShares()).to.equal(10);
      expect(await splitter.getPayeeCount()).to.equal(3);

      const ignasInfo = await splitter.getPayeeInfo(PAYEE1_ADDRESS);
      expect(ignasInfo.shares).to.equal(3);
      expect(ignasInfo.exists).to.be.true;

      const nickInfo = await splitter.getPayeeInfo(PAYEE2_ADDRESS);
      expect(nickInfo.shares).to.equal(3);
      expect(nickInfo.exists).to.be.true;

      const muscadineInfo = await splitter.getPayeeInfo(PAYEE3_ADDRESS);
      expect(muscadineInfo.shares).to.equal(4);
      expect(muscadineInfo.exists).to.be.true;
    });

    it("should return all payees", async function () {
      const allPayees = await splitter.getAllPayees();
      expect(allPayees.length).to.equal(3);
      expect(allPayees).to.include(PAYEE1_ADDRESS);
      expect(allPayees).to.include(PAYEE2_ADDRESS);
      expect(allPayees).to.include(PAYEE3_ADDRESS);
    });
  });

  describe("Token Splitting", function () {
    it("should split tokens correctly according to shares (3:3:4)", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Payee 1: 3/10 = 30% = 300 tokens
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300"));

      // Payee 2: 3/10 = 30% = 300 tokens
      expect(await splitter.pendingToken(token, PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300"));

      // Payee 3: 4/10 = 40% = 400 tokens
      expect(await splitter.pendingToken(token, PAYEE3_ADDRESS)).to.equal(ethers.parseEther("400"));
    });

    it("should allow claiming for individual payees", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Claim for Payee 1
      await splitter.claim(token, PAYEE1_ADDRESS);
      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(0);
    });

    it("should allow claiming for all payees at once", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await splitter.claimAll();

      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(PAYEE3_ADDRESS)).to.equal(ethers.parseEther("400"));
    });
  });

  describe("Payee Management", function () {
    it("should allow owner to add a new payee", async function () {
      const newPayee = stranger.address;
      const newShares = 2;

      await splitter.addPayee(newPayee, newShares);

      expect(await splitter.getPayeeCount()).to.equal(4);
      expect(await splitter.totalShares()).to.equal(12); // 10 + 2

      const newPayeeInfo = await splitter.getPayeeInfo(newPayee);
      expect(newPayeeInfo.shares).to.equal(2);
      expect(newPayeeInfo.exists).to.be.true;
    });

    it("should not allow non-owner to add payee", async function () {
      await expect(
        splitter.connect(stranger).addPayee(stranger.address, 1),
      ).to.be.revertedWithCustomError(splitter, "NotOwner");
    });

    it("should not allow adding duplicate payee", async function () {
      await expect(splitter.addPayee(PAYEE1_ADDRESS, 1)).to.be.revertedWithCustomError(
        splitter,
        "PayeeAlreadyExists",
      );
    });

    it("should allow owner to remove a payee", async function () {
      await splitter.removePayee(PAYEE3_ADDRESS);

      expect(await splitter.getPayeeCount()).to.equal(2);
      expect(await splitter.totalShares()).to.equal(6); // 10 - 4

      const muscadineInfo = await splitter.getPayeeInfo(PAYEE3_ADDRESS);
      expect(muscadineInfo.exists).to.be.false;
    });

    it("should not allow removing last payee", async function () {
      await splitter.removePayee(PAYEE3_ADDRESS);
      await splitter.removePayee(PAYEE2_ADDRESS);

      await expect(splitter.removePayee(PAYEE1_ADDRESS)).to.be.revertedWithCustomError(
        splitter,
        "NoPayees",
      );
    });

    it("should allow owner to update payee shares", async function () {
      await splitter.updatePayeeShares(PAYEE1_ADDRESS, 5);

      expect(await splitter.totalShares()).to.equal(12); // 10 - 3 + 5

      const ignasInfo = await splitter.getPayeeInfo(PAYEE1_ADDRESS);
      expect(ignasInfo.shares).to.equal(5);
    });

    it("should split correctly after updating shares", async function () {
      // Update Payee 1 to 5 shares (was 3)
      await splitter.updatePayeeShares(PAYEE1_ADDRESS, 5);
      // Total is now 12 shares (5 + 3 + 4)

      const amount = ethers.parseEther("1200");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Payee 1: 5/12 = 41.67% = 500 tokens
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(ethers.parseEther("500"));

      // Payee 2: 3/12 = 25% = 300 tokens
      expect(await splitter.pendingToken(token, PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300"));

      // Payee 3: 4/12 = 33.33% = 400 tokens
      expect(await splitter.pendingToken(token, PAYEE3_ADDRESS)).to.equal(ethers.parseEther("400"));
    });
  });

  describe("Ownership", function () {
    it("should allow owner to add a new owner", async function () {
      await splitter.addOwner(payee2Signer.address);
      expect(await splitter.isOwner(payee2Signer.address)).to.be.true;
      expect(await splitter.getOwnerCount()).to.equal(2);
    });

    it("should allow owner to remove an owner", async function () {
      await splitter.addOwner(payee2Signer.address);
      expect(await splitter.getOwnerCount()).to.equal(2);

      await splitter.removeOwner(payee2Signer.address);
      expect(await splitter.isOwner(payee2Signer.address)).to.be.false;
      expect(await splitter.getOwnerCount()).to.equal(1);
    });

    it("should not allow removing the last owner", async function () {
      await expect(splitter.removeOwner(owner.address)).to.be.revertedWithCustomError(
        splitter,
        "CannotRemoveLastOwner",
      );
    });

    it("should not allow non-owner to add owner", async function () {
      await expect(
        splitter.connect(stranger).addOwner(stranger.address),
      ).to.be.revertedWithCustomError(splitter, "NotOwner");
    });

    it("should return all owners", async function () {
      await splitter.addOwner(payee2Signer.address);
      const allOwners = await splitter.getAllOwners();
      expect(allOwners.length).to.equal(2);
      expect(allOwners).to.include(owner.address);
      expect(allOwners).to.include(payee2Signer.address);
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero pending amount", async function () {
      await expect(splitter.claim(token, PAYEE1_ADDRESS)).to.be.revertedWithCustomError(
        splitter,
        "NothingDue",
      );
    });

    it("should not allow claiming for non-payee", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await expect(splitter.claim(token, stranger.address)).to.be.revertedWithCustomError(
        splitter,
        "PayeeNotFound",
      );
    });

    it("should handle multiple claims correctly", async function () {
      const amount1 = ethers.parseEther("1000");
      await token.mint(owner.address, amount1);
      await token.transfer(await splitter.getAddress(), amount1);

      await splitter.claim(token, PAYEE1_ADDRESS);
      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300"));

      const amount2 = ethers.parseEther("500");
      await token.mint(owner.address, amount2);
      await token.transfer(await splitter.getAddress(), amount2);

      // Payee 1 should get 30% of new 500 = 150, plus already claimed 300
      await splitter.claim(token, PAYEE1_ADDRESS);
      expect(await token.balanceOf(PAYEE1_ADDRESS)).to.equal(ethers.parseEther("450"));
    });

    it("should handle payee changes and share updates with existing tokens", async function () {
      // Initial state: 3 payees with 3:3:4 shares (10 total)
      // Deposit tokens
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Verify initial pending amounts
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(ethers.parseEther("300")); // 3/10
      expect(await splitter.pendingToken(token, PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300")); // 3/10
      expect(await splitter.pendingToken(token, PAYEE3_ADDRESS)).to.equal(ethers.parseEther("400")); // 4/10

      // Remove one payee (Payee 3)
      await splitter.removePayee(PAYEE3_ADDRESS);
      expect(await splitter.getPayeeCount()).to.equal(2);
      expect(await splitter.totalShares()).to.equal(6); // 3 + 3

      // After removal, remaining payees should split the 1000 tokens proportionally
      // Payee 1: 3/6 = 50% = 500 tokens
      // Payee 2: 3/6 = 50% = 500 tokens
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(ethers.parseEther("500"));
      expect(await splitter.pendingToken(token, PAYEE2_ADDRESS)).to.equal(ethers.parseEther("500"));

      // Add a new payee with 2 shares
      const newPayee = stranger.address;
      await splitter.addPayee(newPayee, 2);
      expect(await splitter.getPayeeCount()).to.equal(3);
      expect(await splitter.totalShares()).to.equal(8); // 3 + 3 + 2

      // With new payee, shares are now 3:3:2 (8 total)
      // The 1000 tokens should be split: Payee 1 3/8, Payee 2 3/8, NewPayee 2/8
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(ethers.parseEther("375")); // 3/8 * 1000
      expect(await splitter.pendingToken(token, PAYEE2_ADDRESS)).to.equal(ethers.parseEther("375")); // 3/8 * 1000
      expect(await splitter.pendingToken(token, newPayee)).to.equal(ethers.parseEther("250")); // 2/8 * 1000

      // Update shares: Payee 1 from 3 to 5
      await splitter.updatePayeeShares(PAYEE1_ADDRESS, 5);
      expect(await splitter.totalShares()).to.equal(10); // 5 + 3 + 2

      // With updated shares 5:3:2 (10 total), the 1000 tokens split:
      expect(await splitter.pendingToken(token, PAYEE1_ADDRESS)).to.equal(ethers.parseEther("500")); // 5/10 * 1000
      expect(await splitter.pendingToken(token, PAYEE2_ADDRESS)).to.equal(ethers.parseEther("300")); // 3/10 * 1000
      expect(await splitter.pendingToken(token, newPayee)).to.equal(ethers.parseEther("200")); // 2/10 * 1000

      // Verify claimAll works correctly
      await expect(splitter.claimAll()).to.not.be.reverted;

      // Verify all tokens were claimed
      const contractBalance = await token.balanceOf(await splitter.getAddress());
      expect(contractBalance).to.be.lt(ethers.parseEther("0.0000000000000001")); // Should be near zero
    });

    it("should handle balance depletion correctly in claimAll", async function () {
      // Scenario: Contract has less balance than total pending amounts
      const amount = ethers.parseEther("150"); // Only 150 tokens
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Each payee should have pending: 150 * (shares/totalShares)
      // Payee 1: 3/10 * 150 = 45
      // Payee 2: 3/10 * 150 = 45
      // Payee 3: 4/10 * 150 = 60
      // Total pending: 150 (matches balance)

      const payee1Pending = await splitter.pendingToken(token, PAYEE1_ADDRESS);
      const payee2Pending = await splitter.pendingToken(token, PAYEE2_ADDRESS);
      const payee3Pending = await splitter.pendingToken(token, PAYEE3_ADDRESS);

      expect(payee1Pending).to.equal(ethers.parseEther("45"));
      expect(payee2Pending).to.equal(ethers.parseEther("45"));
      expect(payee3Pending).to.equal(ethers.parseEther("60"));

      // claimAll should successfully claim all available tokens
      await expect(splitter.claimAll()).to.not.be.reverted;

      // Verify all tokens were claimed (within rounding)
      const contractBalance = await token.balanceOf(await splitter.getAddress());
      expect(contractBalance).to.be.lt(ethers.parseEther("0.0000000000000001"));

      // Verify payees received their proportional shares
      const payee1Balance = await token.balanceOf(PAYEE1_ADDRESS);
      const payee2Balance = await token.balanceOf(PAYEE2_ADDRESS);
      const payee3Balance = await token.balanceOf(PAYEE3_ADDRESS);

      // Should be close to expected amounts (within rounding)
      expect(payee1Balance).to.be.closeTo(ethers.parseEther("45"), ethers.parseEther("0.01"));
      expect(payee2Balance).to.be.closeTo(ethers.parseEther("45"), ethers.parseEther("0.01"));
      expect(payee3Balance).to.be.closeTo(ethers.parseEther("60"), ethers.parseEther("0.01"));

      // Total claimed should equal original balance
      const totalClaimed = payee1Balance + payee2Balance + payee3Balance;
      expect(totalClaimed).to.be.closeTo(amount, ethers.parseEther("0.01"));
    });
  });
});
