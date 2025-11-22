import { expect } from "chai";
import { ethers } from "hardhat";
import { ERC20FeeSplitter, ERC20Mock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitter - Vault Token Compatibility", function () {
  let splitter: ERC20FeeSplitter;
  let usdc: ERC20Mock;
  let cbbtc: ERC20Mock;
  let weth: ERC20Mock;
  let owner: HardhatEthersSigner;
  let nick: HardhatEthersSigner;
  let ignas: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, nick, ignas] = await ethers.getSigners();

    // Deploy ERC20FeeSplitter with 50/50 split
    const Splitter = await ethers.getContractFactory("ERC20FeeSplitter");
    splitter = await Splitter.deploy(
      await nick.getAddress(), // payee1
      await ignas.getAddress(), // payee2
      1, // shares1 (50%)
      1, // shares2 (50%)
    );
    await splitter.waitForDeployment();

    // Deploy mock tokens with correct decimals for each vault token
    const TokenFactory = await ethers.getContractFactory("ERC20Mock");

    // USDC - 6 decimals
    usdc = await TokenFactory.deploy("USD Coin", "USDC", 6);
    await usdc.waitForDeployment();

    // cbBTC - 8 decimals
    cbbtc = await TokenFactory.deploy("Coinbase Wrapped BTC", "cbBTC", 8);
    await cbbtc.waitForDeployment();

    // WETH - 18 decimals
    weth = await TokenFactory.deploy("Wrapped Ether", "WETH", 18);
    await weth.waitForDeployment();
  });

  describe("USDC (6 decimals)", function () {
    it("should split USDC 50/50 correctly", async function () {
      const amount = ethers.parseUnits("1000", 6); // 1000 USDC

      await usdc.mint(await owner.getAddress(), amount);
      await usdc.transfer(await splitter.getAddress(), amount);

      const nickPending = await splitter.pendingToken(
        await usdc.getAddress(),
        await nick.getAddress(),
      );
      const ignasPending = await splitter.pendingToken(
        await usdc.getAddress(),
        await ignas.getAddress(),
      );

      expect(nickPending).to.equal(ethers.parseUnits("500", 6));
      expect(ignasPending).to.equal(ethers.parseUnits("500", 6));
    });

    it("should handle small USDC amounts (vault fees)", async function () {
      const smallAmount = ethers.parseUnits("11.333333", 6); // Typical small vault fee

      await usdc.mint(await owner.getAddress(), smallAmount);
      await usdc.transfer(await splitter.getAddress(), smallAmount);

      const nickPending = await splitter.pendingToken(
        await usdc.getAddress(),
        await nick.getAddress(),
      );
      const ignasPending = await splitter.pendingToken(
        await usdc.getAddress(),
        await ignas.getAddress(),
      );

      // 50/50 split
      expect(nickPending).to.equal(ethers.parseUnits("5.666666", 6));
      expect(ignasPending).to.equal(ethers.parseUnits("5.666666", 6));

      // Total should be very close (may have 1 wei dust due to rounding)
      expect(nickPending + ignasPending).to.be.closeTo(smallAmount, 1n);
    });

    it("should allow claiming USDC", async function () {
      const amount = ethers.parseUnits("1000", 6);

      await usdc.mint(await owner.getAddress(), amount);
      await usdc.transfer(await splitter.getAddress(), amount);

      await splitter.connect(nick).claim(await usdc.getAddress(), await nick.getAddress());
      await splitter.connect(ignas).claim(await usdc.getAddress(), await ignas.getAddress());

      expect(await usdc.balanceOf(await nick.getAddress())).to.equal(ethers.parseUnits("500", 6));
      expect(await usdc.balanceOf(await ignas.getAddress())).to.equal(ethers.parseUnits("500", 6));
    });
  });

  describe("cbBTC (8 decimals)", function () {
    it("should split cbBTC 50/50 correctly", async function () {
      const amount = ethers.parseUnits("0.5", 8); // 0.5 cbBTC

      await cbbtc.mint(await owner.getAddress(), amount);
      await cbbtc.transfer(await splitter.getAddress(), amount);

      const nickPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        await nick.getAddress(),
      );
      const ignasPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        await ignas.getAddress(),
      );

      expect(nickPending).to.equal(ethers.parseUnits("0.25", 8));
      expect(ignasPending).to.equal(ethers.parseUnits("0.25", 8));
    });

    it("should handle precise cbBTC amounts", async function () {
      const amount = ethers.parseUnits("0.00123456", 8); // Small precise amount

      await cbbtc.mint(await owner.getAddress(), amount);
      await cbbtc.transfer(await splitter.getAddress(), amount);

      const nickPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        await nick.getAddress(),
      );
      const ignasPending = await splitter.pendingToken(
        await cbbtc.getAddress(),
        await ignas.getAddress(),
      );

      expect(nickPending).to.equal(ethers.parseUnits("0.00061728", 8));
      expect(ignasPending).to.equal(ethers.parseUnits("0.00061728", 8));
    });
  });

  describe("WETH (18 decimals)", function () {
    it("should split WETH 50/50 correctly", async function () {
      const amount = ethers.parseUnits("10", 18); // 10 WETH

      await weth.mint(await owner.getAddress(), amount);
      await weth.transfer(await splitter.getAddress(), amount);

      const nickPending = await splitter.pendingToken(
        await weth.getAddress(),
        await nick.getAddress(),
      );
      const ignasPending = await splitter.pendingToken(
        await weth.getAddress(),
        await ignas.getAddress(),
      );

      expect(nickPending).to.equal(ethers.parseUnits("5", 18));
      expect(ignasPending).to.equal(ethers.parseUnits("5", 18));
    });

    it("should handle fractional WETH amounts", async function () {
      const amount = ethers.parseUnits("0.123456789", 18);

      await weth.mint(await owner.getAddress(), amount);
      await weth.transfer(await splitter.getAddress(), amount);

      const nickPending = await splitter.pendingToken(
        await weth.getAddress(),
        await nick.getAddress(),
      );
      const ignasPending = await splitter.pendingToken(
        await weth.getAddress(),
        await ignas.getAddress(),
      );

      // Should split exactly 50/50
      expect(nickPending + ignasPending).to.equal(amount);
      expect(nickPending).to.equal(ignasPending);
    });
  });

  describe("Multi-Token Scenario (All Three Vaults)", function () {
    it("should handle fees from all three vaults simultaneously", async function () {
      // Simulate fees from all three Morpho vaults
      const usdcFees = ethers.parseUnits("1000", 6);
      const cbbtcFees = ethers.parseUnits("0.1", 8);
      const wethFees = ethers.parseUnits("5", 18);

      // Send fees from all vaults
      await usdc.mint(await owner.getAddress(), usdcFees);
      await usdc.transfer(await splitter.getAddress(), usdcFees);

      await cbbtc.mint(await owner.getAddress(), cbbtcFees);
      await cbbtc.transfer(await splitter.getAddress(), cbbtcFees);

      await weth.mint(await owner.getAddress(), wethFees);
      await weth.transfer(await splitter.getAddress(), wethFees);

      // Verify Nick's pending amounts
      expect(
        await splitter.pendingToken(await usdc.getAddress(), await nick.getAddress()),
      ).to.equal(ethers.parseUnits("500", 6));
      expect(
        await splitter.pendingToken(await cbbtc.getAddress(), await nick.getAddress()),
      ).to.equal(ethers.parseUnits("0.05", 8));
      expect(
        await splitter.pendingToken(await weth.getAddress(), await nick.getAddress()),
      ).to.equal(ethers.parseUnits("2.5", 18));

      // Verify Ignas's pending amounts
      expect(
        await splitter.pendingToken(await usdc.getAddress(), await ignas.getAddress()),
      ).to.equal(ethers.parseUnits("500", 6));
      expect(
        await splitter.pendingToken(await cbbtc.getAddress(), await ignas.getAddress()),
      ).to.equal(ethers.parseUnits("0.05", 8));
      expect(
        await splitter.pendingToken(await weth.getAddress(), await ignas.getAddress()),
      ).to.equal(ethers.parseUnits("2.5", 18));
    });

    it("should allow claiming from multiple vaults", async function () {
      // Send fees
      await usdc.mint(await owner.getAddress(), ethers.parseUnits("100", 6));
      await usdc.transfer(await splitter.getAddress(), ethers.parseUnits("100", 6));

      await cbbtc.mint(await owner.getAddress(), ethers.parseUnits("0.01", 8));
      await cbbtc.transfer(await splitter.getAddress(), ethers.parseUnits("0.01", 8));

      await weth.mint(await owner.getAddress(), ethers.parseUnits("1", 18));
      await weth.transfer(await splitter.getAddress(), ethers.parseUnits("1", 18));

      // Nick claims all
      await splitter.connect(nick).claim(await usdc.getAddress(), await nick.getAddress());
      await splitter.connect(nick).claim(await cbbtc.getAddress(), await nick.getAddress());
      await splitter.connect(nick).claim(await weth.getAddress(), await nick.getAddress());

      // Verify balances
      expect(await usdc.balanceOf(await nick.getAddress())).to.equal(ethers.parseUnits("50", 6));
      expect(await cbbtc.balanceOf(await nick.getAddress())).to.equal(
        ethers.parseUnits("0.005", 8),
      );
      expect(await weth.balanceOf(await nick.getAddress())).to.equal(ethers.parseUnits("0.5", 18));
    });
  });
});
