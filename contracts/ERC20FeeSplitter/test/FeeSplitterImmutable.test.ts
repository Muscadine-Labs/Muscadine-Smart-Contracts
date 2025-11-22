import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitter, ERC20Mock, DeflationaryMock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitter", function () {
  let splitter: ERC20FeeSplitter;
  let usdc: ERC20Mock;
  let cbbtc: ERC20Mock;
  let weth: ERC20Mock;
  let deflToken: DeflationaryMock;
  let deployer: HardhatEthersSigner;
  let nick: HardhatEthersSigner;
  let ignas: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const NICK_ADDRESS = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
  const IGNAS_ADDRESS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";

  beforeEach(async function () {
    [deployer, nick, ignas, stranger] = await ethers.getSigners();

    // Deploy ERC20FeeSplitter with FIXED configuration
    const Splitter = await ethers.getContractFactory("ERC20FeeSplitter");
    splitter = await Splitter.deploy(
      NICK_ADDRESS, // payee1
      IGNAS_ADDRESS, // payee2
      1, // shares1 (50%)
      1, // shares2 (50%)
    );
    await splitter.waitForDeployment();

    // Deploy mock tokens
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");
    usdc = await TokenFactory.deploy("USD Coin", "USDC", 6);
    cbbtc = await TokenFactory.deploy("Coinbase BTC", "cbBTC", 8);
    weth = await TokenFactory.deploy("Wrapped ETH", "WETH", 18);

    const DeflFactory = await ethers.getContractFactory("DeflationaryMock");
    deflToken = await DeflFactory.deploy("Deflationary", "DEFL", 18);
  });

  describe("Deployment", function () {
    it("should set correct payees and shares (immutable)", async function () {
      expect(await splitter.PAYEE1()).to.equal(NICK_ADDRESS);
      expect(await splitter.PAYEE2()).to.equal(IGNAS_ADDRESS);
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


  describe("Vault Tokens", function () {
    it("should split USDC vault fees 50/50", async function () {
      const fees = ethers.parseUnits("1000", 6);

      await usdc.mint(await deployer.getAddress(), fees);
      await usdc.transfer(await splitter.getAddress(), fees);

      expect(await splitter.pendingToken(await usdc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("500", 6),
      );
      expect(await splitter.pendingToken(await usdc.getAddress(), IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("500", 6),
      );
    });

    it("should split cbBTC vault fees 50/50", async function () {
      const fees = ethers.parseUnits("0.5", 8);

      await cbbtc.mint(await deployer.getAddress(), fees);
      await cbbtc.transfer(await splitter.getAddress(), fees);

      expect(await splitter.pendingToken(await cbbtc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("0.25", 8),
      );
      expect(await splitter.pendingToken(await cbbtc.getAddress(), IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("0.25", 8),
      );
    });

    it("should split WETH vault fees 50/50", async function () {
      const fees = ethers.parseUnits("10", 18);

      await weth.mint(await deployer.getAddress(), fees);
      await weth.transfer(await splitter.getAddress(), fees);

      expect(await splitter.pendingToken(await weth.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("5", 18),
      );
      expect(await splitter.pendingToken(await weth.getAddress(), IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("5", 18),
      );
    });

    it("should handle all three vault tokens simultaneously", async function () {
      await usdc.mint(await deployer.getAddress(), ethers.parseUnits("1000", 6));
      await usdc.transfer(await splitter.getAddress(), ethers.parseUnits("1000", 6));

      await cbbtc.mint(await deployer.getAddress(), ethers.parseUnits("0.1", 8));
      await cbbtc.transfer(await splitter.getAddress(), ethers.parseUnits("0.1", 8));

      await weth.mint(await deployer.getAddress(), ethers.parseUnits("5", 18));
      await weth.transfer(await splitter.getAddress(), ethers.parseUnits("5", 18));

      // Verify all splits are 50/50
      expect(await splitter.pendingToken(await usdc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("500", 6),
      );
      expect(await splitter.pendingToken(await cbbtc.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("0.05", 8),
      );
      expect(await splitter.pendingToken(await weth.getAddress(), NICK_ADDRESS)).to.equal(
        ethers.parseUnits("2.5", 18),
      );
    });
  });

  describe("Deflationary Token Support", function () {
    it("should handle deflationary tokens correctly", async function () {
      const amount = ethers.parseUnits("1000", 18);

      await deflToken.mint(await deployer.getAddress(), amount);
      await deflToken.transfer(await splitter.getAddress(), amount);

      const splitterBalance = await deflToken.balanceOf(await splitter.getAddress());
      expect(splitterBalance).to.equal(ethers.parseUnits("990", 18)); // 1% burned

      // Impersonate nick
      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });

      await splitter.connect(nickSigner).claim(await deflToken.getAddress(), NICK_ADDRESS);

      const balance = await deflToken.balanceOf(NICK_ADDRESS);
      expect(balance).to.be.closeTo(ethers.parseUnits("490.05", 18), ethers.parseUnits("0.01", 18));
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
        splitter.connect(stranger).claim(await usdc.getAddress(), await stranger.getAddress()),
      ).to.be.revertedWithCustomError(splitter, "NotPayee");
    });
  });

  describe("Edge Cases", function () {
    it("should revert when claiming with nothing due", async function () {
      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });

      await expect(
        splitter.connect(nickSigner).claim(await usdc.getAddress(), NICK_ADDRESS),
      ).to.be.revertedWithCustomError(splitter, "NothingDue");
    });

    it("should handle multiple claims correctly", async function () {
      // Send some USDC to the contract
      const amount1 = ethers.parseUnits("1000", 6);
      await usdc.mint(await deployer.getAddress(), amount1);
      await usdc.transfer(await splitter.getAddress(), amount1);

      await ethers.provider.send("hardhat_impersonateAccount", [NICK_ADDRESS]);
      const nickSigner = await ethers.getSigner(NICK_ADDRESS);
      await deployer.sendTransaction({ to: NICK_ADDRESS, value: ethers.parseEther("1") });

      await splitter.connect(nickSigner).claim(await usdc.getAddress(), NICK_ADDRESS);
      expect(await splitter.pendingToken(await usdc.getAddress(), NICK_ADDRESS)).to.equal(0);

      // Send more USDC to the contract
      const amount2 = ethers.parseUnits("2000", 6);
      await usdc.mint(await deployer.getAddress(), amount2);
      await usdc.transfer(await splitter.getAddress(), amount2);

      expect(await splitter.pendingToken(await usdc.getAddress(), NICK_ADDRESS)).to.equal(amount2 / 2n);
    });
  });
});
