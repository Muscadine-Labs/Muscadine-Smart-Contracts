import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ERC20FeeSplitterV2, ERC20Mock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitterV2", function () {
  let splitter: ERC20FeeSplitterV2;
  let token: ERC20Mock;
  let owner: HardhatEthersSigner;
  let ignas: HardhatEthersSigner;
  let nick: HardhatEthersSigner;
  let muscadine: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const IGNAS_ADDRESS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
  const NICK_ADDRESS = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
  const MUSCADINE_ADDRESS = "0x1111111111111111111111111111111111111111";

  beforeEach(async function () {
    [owner, ignas, nick, muscadine, stranger] = await ethers.getSigners();

    // Deploy ERC20FeeSplitterV2 with initial configuration
    const ERC20FeeSplitterV2Factory = await ethers.getContractFactory("ERC20FeeSplitterV2");
    splitter = await upgrades.deployProxy(
      ERC20FeeSplitterV2Factory,
      [
        [IGNAS_ADDRESS, NICK_ADDRESS, MUSCADINE_ADDRESS],
        [3, 3, 4], // 3 + 3 + 4 = 10 shares total
        owner.address
      ],
      { kind: "uups", initializer: "initialize" }
    ) as unknown as ERC20FeeSplitterV2;
    await splitter.waitForDeployment();

    // Deploy mock ERC20 token
    const TokenFactory = await ethers.getContractFactory("contracts/ERC20FeeSplitter-V2/mocks/ERC20Mock.sol:ERC20Mock");
    token = await TokenFactory.deploy("Test Token", "TEST", 18);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should initialize with correct payees and shares", async function () {
      expect(await splitter.owner()).to.equal(owner.address);
      expect(await splitter.totalShares()).to.equal(10);
      expect(await splitter.getPayeeCount()).to.equal(3);

      const ignasInfo = await splitter.getPayeeInfo(IGNAS_ADDRESS);
      expect(ignasInfo.shares).to.equal(3);
      expect(ignasInfo.exists).to.be.true;

      const nickInfo = await splitter.getPayeeInfo(NICK_ADDRESS);
      expect(nickInfo.shares).to.equal(3);
      expect(nickInfo.exists).to.be.true;

      const muscadineInfo = await splitter.getPayeeInfo(MUSCADINE_ADDRESS);
      expect(muscadineInfo.shares).to.equal(4);
      expect(muscadineInfo.exists).to.be.true;
    });

    it("should return all payees", async function () {
      const allPayees = await splitter.getAllPayees();
      expect(allPayees.length).to.equal(3);
      expect(allPayees).to.include(IGNAS_ADDRESS);
      expect(allPayees).to.include(NICK_ADDRESS);
      expect(allPayees).to.include(MUSCADINE_ADDRESS);
    });
  });

  describe("Token Splitting", function () {
    it("should split tokens correctly according to shares (3:3:4)", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Ignas: 3/10 = 30% = 300 tokens
      expect(await splitter.pendingToken(token, IGNAS_ADDRESS)).to.equal(ethers.parseEther("300"));
      
      // Nick: 3/10 = 30% = 300 tokens
      expect(await splitter.pendingToken(token, NICK_ADDRESS)).to.equal(ethers.parseEther("300"));
      
      // Muscadine: 4/10 = 40% = 400 tokens
      expect(await splitter.pendingToken(token, MUSCADINE_ADDRESS)).to.equal(ethers.parseEther("400"));
    });

    it("should allow claiming for individual payees", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Claim for Ignas
      await splitter.claim(token, IGNAS_ADDRESS);
      expect(await token.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await splitter.pendingToken(token, IGNAS_ADDRESS)).to.equal(0);
    });

    it("should allow claiming for all payees at once", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await splitter.claimAll(token);

      expect(await token.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(NICK_ADDRESS)).to.equal(ethers.parseEther("300"));
      expect(await token.balanceOf(MUSCADINE_ADDRESS)).to.equal(ethers.parseEther("400"));
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
        splitter.connect(stranger).addPayee(stranger.address, 1)
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });

    it("should not allow adding duplicate payee", async function () {
      await expect(
        splitter.addPayee(IGNAS_ADDRESS, 1)
      ).to.be.revertedWithCustomError(splitter, "PayeeAlreadyExists");
    });

    it("should allow owner to remove a payee", async function () {
      await splitter.removePayee(MUSCADINE_ADDRESS);

      expect(await splitter.getPayeeCount()).to.equal(2);
      expect(await splitter.totalShares()).to.equal(6); // 10 - 4

      const muscadineInfo = await splitter.getPayeeInfo(MUSCADINE_ADDRESS);
      expect(muscadineInfo.exists).to.be.false;
    });

    it("should not allow removing last payee", async function () {
      await splitter.removePayee(MUSCADINE_ADDRESS);
      await splitter.removePayee(NICK_ADDRESS);
      
      await expect(
        splitter.removePayee(IGNAS_ADDRESS)
      ).to.be.revertedWithCustomError(splitter, "NoPayees");
    });

    it("should allow owner to update payee shares", async function () {
      await splitter.updatePayeeShares(IGNAS_ADDRESS, 5);

      expect(await splitter.totalShares()).to.equal(12); // 10 - 3 + 5

      const ignasInfo = await splitter.getPayeeInfo(IGNAS_ADDRESS);
      expect(ignasInfo.shares).to.equal(5);
    });

    it("should split correctly after updating shares", async function () {
      // Update Ignas to 5 shares (was 3)
      await splitter.updatePayeeShares(IGNAS_ADDRESS, 5);
      // Total is now 12 shares (5 + 3 + 4)

      const amount = ethers.parseEther("1200");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      // Ignas: 5/12 = 41.67% = 500 tokens
      expect(await splitter.pendingToken(token, IGNAS_ADDRESS)).to.equal(ethers.parseEther("500"));
      
      // Nick: 3/12 = 25% = 300 tokens
      expect(await splitter.pendingToken(token, NICK_ADDRESS)).to.equal(ethers.parseEther("300"));
      
      // Muscadine: 4/12 = 33.33% = 400 tokens
      expect(await splitter.pendingToken(token, MUSCADINE_ADDRESS)).to.equal(ethers.parseEther("400"));
    });
  });

  describe("Ownership", function () {
    it("should allow owner to transfer ownership", async function () {
      await splitter.transferOwnership(nick.address);
      expect(await splitter.owner()).to.equal(nick.address);
    });

    it("should not allow non-owner to transfer ownership", async function () {
      await expect(
        splitter.connect(stranger).transferOwnership(stranger.address)
      ).to.be.revertedWithCustomError(splitter, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("should handle zero pending amount", async function () {
      await expect(
        splitter.claim(token, IGNAS_ADDRESS)
      ).to.be.revertedWithCustomError(splitter, "NothingDue");
    });

    it("should not allow claiming for non-payee", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(owner.address, amount);
      await token.transfer(await splitter.getAddress(), amount);

      await expect(
        splitter.claim(token, stranger.address)
      ).to.be.revertedWithCustomError(splitter, "PayeeNotFound");
    });

    it("should handle multiple claims correctly", async function () {
      const amount1 = ethers.parseEther("1000");
      await token.mint(owner.address, amount1);
      await token.transfer(await splitter.getAddress(), amount1);

      await splitter.claim(token, IGNAS_ADDRESS);
      expect(await token.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseEther("300"));

      const amount2 = ethers.parseEther("500");
      await token.mint(owner.address, amount2);
      await token.transfer(await splitter.getAddress(), amount2);

      // Ignas should get 30% of new 500 = 150, plus already claimed 300
      await splitter.claim(token, IGNAS_ADDRESS);
      expect(await token.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseEther("450"));
    });
  });
});

