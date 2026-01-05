import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitter, ERC20Mock } from "../../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitter", function () {
  let splitter: ERC20FeeSplitter;
  let token: ERC20Mock;
  let deployer: HardhatEthersSigner;
  let payee1Signer: HardhatEthersSigner;
  let payee2Signer: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const PAYEE1_ADDRESS = "0x1111111111111111111111111111111111111111" as const;
  const PAYEE2_ADDRESS = "0x2222222222222222222222222222222222222222" as const;

  beforeEach(async function () {
    [deployer, payee1Signer, payee2Signer, stranger] = await ethers.getSigners();

    // Deploy ERC20FeeSplitter with FIXED configuration
    const Splitter = await ethers.getContractFactory("ERC20FeeSplitter");
    splitter = await Splitter.deploy(
      PAYEE1_ADDRESS, // payee1
      PAYEE2_ADDRESS, // payee2
      1, // shares1 (50%)
      1, // shares2 (50%)
    );
    await splitter.waitForDeployment();

    // Deploy mock token
    const TokenFactory = await ethers.getContractFactory("contracts/mocks/ERC20Mock.sol:ERC20Mock");
    token = (await TokenFactory.deploy("Test Token", "TEST", 18)) as ERC20Mock;
  });

  describe("Deployment", function () {
    it("should set correct payees and shares (immutable)", async function () {
      expect(await splitter.PAYEE1()).to.equal(PAYEE1_ADDRESS);
      expect(await splitter.PAYEE2()).to.equal(PAYEE2_ADDRESS);
      expect(await splitter.SHARES1()).to.equal(1);
      expect(await splitter.SHARES2()).to.equal(1);
      expect(await splitter.TOTAL_SHARES()).to.equal(2);
    });

    it("should have no owner (fully immutable)", async function () {
      // Contract has no owner() function - this should not exist
      const contract = splitter as any;
      expect(contract.owner).to.be.undefined;
    });
  });

  describe("Token Splitting", function () {
    it("should split tokens correctly 50/50", async function () {
      const amount = ethers.parseEther("1000");
      await token.mint(await deployer.getAddress(), amount);
      await token.transfer(await splitter.getAddress(), amount);

      expect(await splitter.pendingToken(await token.getAddress(), PAYEE1_ADDRESS)).to.equal(
        ethers.parseEther("500"),
      );
      expect(await splitter.pendingToken(await token.getAddress(), PAYEE2_ADDRESS)).to.equal(
        ethers.parseEther("500"),
      );
    });
  });

  describe("Immutability", function () {
    it("should not have owner function", async function () {
      const contract = splitter as any;
      expect(contract.owner).to.be.undefined;
    });

    it("should not have setPayees function", async function () {
      const contract = splitter as any;
      expect(contract.setPayees).to.be.undefined;
    });

    it("should not have pause function", async function () {
      const contract = splitter as any;
      expect(contract.pause).to.be.undefined;
    });

    it("should reject non-payee from claiming", async function () {
      await expect(
        splitter.connect(stranger).claim(await token.getAddress(), await stranger.getAddress()),
      ).to.be.revertedWithCustomError(splitter, "NotPayee");
    });
  });

  describe("Edge Cases", function () {
    it("should revert when claiming with nothing due", async function () {
      await ethers.provider.send("hardhat_impersonateAccount", [PAYEE1_ADDRESS]);
      const payee1Signer = await ethers.getSigner(PAYEE1_ADDRESS);
      await deployer.sendTransaction({ to: PAYEE1_ADDRESS, value: ethers.parseEther("1") });

      await expect(
        splitter.connect(payee1Signer).claim(await token.getAddress(), PAYEE1_ADDRESS),
      ).to.be.revertedWithCustomError(splitter, "NothingDue");
    });
  });
});
