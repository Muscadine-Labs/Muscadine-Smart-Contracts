import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { ERC20FeeSplitterV2, ERC20Mock } from "../../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("ERC20FeeSplitterV2 - Vault Token Compatibility", function () {
  let splitter: ERC20FeeSplitterV2;
  let usdc: ERC20Mock;
  let cbbtc: ERC20Mock;
  let weth: ERC20Mock;
  let owner: HardhatEthersSigner;
  let ignas: HardhatEthersSigner;
  let nick: HardhatEthersSigner;
  let muscadine: HardhatEthersSigner;

  const IGNAS_ADDRESS = "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261";
  const NICK_ADDRESS = "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333";
  const MUSCADINE_ADDRESS = "0x057fd8B961Eb664baA647a5C7A6e9728fabA266A";

  beforeEach(async function () {
    [owner, ignas, nick, muscadine] = await ethers.getSigners();

    // Deploy ERC20FeeSplitterV2 with production configuration
    const ERC20FeeSplitterV2Factory = await ethers.getContractFactory("ERC20FeeSplitterV2");
    splitter = (await upgrades.deployProxy(
      ERC20FeeSplitterV2Factory,
      [[IGNAS_ADDRESS, NICK_ADDRESS, MUSCADINE_ADDRESS], [3, 3, 4], owner.address],
      { kind: "uups", initializer: "initialize" },
    )) as unknown as ERC20FeeSplitterV2;
    await splitter.waitForDeployment();

    // Deploy mock tokens with correct decimals
    const TokenFactory = await ethers.getContractFactory(
      "contracts/ERC20FeeSplitter-V2/mocks/ERC20Mock.sol:ERC20Mock",
    );
    usdc = await TokenFactory.deploy("USD Coin", "USDC", 6);
    cbbtc = await TokenFactory.deploy("Coinbase Wrapped BTC", "cbBTC", 8);
    weth = await TokenFactory.deploy("Wrapped Ether", "WETH", 18);
  });

  describe("USDC (6 decimals)", function () {
    it("should split USDC correctly (3:3:4)", async function () {
      const amount = ethers.parseUnits("1000", 6); // 1000 USDC
      await usdc.mint(owner.address, amount);
      await usdc.transfer(await splitter.getAddress(), amount);

      // Ignas: 3/10 = 300 USDC
      expect(await splitter.pendingToken(usdc, IGNAS_ADDRESS)).to.equal(
        ethers.parseUnits("300", 6),
      );
      // Nick: 3/10 = 300 USDC
      expect(await splitter.pendingToken(usdc, NICK_ADDRESS)).to.equal(ethers.parseUnits("300", 6));
      // Muscadine: 4/10 = 400 USDC
      expect(await splitter.pendingToken(usdc, MUSCADINE_ADDRESS)).to.equal(
        ethers.parseUnits("400", 6),
      );
    });

    it("should handle small USDC amounts", async function () {
      const amount = ethers.parseUnits("1", 6); // 1 USDC
      await usdc.mint(owner.address, amount);
      await usdc.transfer(await splitter.getAddress(), amount);

      await splitter.claimAll(usdc);
      // Should handle rounding correctly
      const totalClaimed =
        (await usdc.balanceOf(IGNAS_ADDRESS)) +
        (await usdc.balanceOf(NICK_ADDRESS)) +
        (await usdc.balanceOf(MUSCADINE_ADDRESS));
      expect(totalClaimed).to.equal(amount);
    });
  });

  describe("cbBTC (8 decimals)", function () {
    it("should split cbBTC correctly (3:3:4)", async function () {
      const amount = ethers.parseUnits("10", 8); // 10 cbBTC
      await cbbtc.mint(owner.address, amount);
      await cbbtc.transfer(await splitter.getAddress(), amount);

      // Ignas: 3/10 = 3 cbBTC
      expect(await splitter.pendingToken(cbbtc, IGNAS_ADDRESS)).to.equal(ethers.parseUnits("3", 8));
      // Nick: 3/10 = 3 cbBTC
      expect(await splitter.pendingToken(cbbtc, NICK_ADDRESS)).to.equal(ethers.parseUnits("3", 8));
      // Muscadine: 4/10 = 4 cbBTC
      expect(await splitter.pendingToken(cbbtc, MUSCADINE_ADDRESS)).to.equal(
        ethers.parseUnits("4", 8),
      );
    });
  });

  describe("WETH (18 decimals)", function () {
    it("should split WETH correctly (3:3:4)", async function () {
      const amount = ethers.parseEther("100"); // 100 WETH
      await weth.mint(owner.address, amount);
      await weth.transfer(await splitter.getAddress(), amount);

      // Ignas: 3/10 = 30 WETH
      expect(await splitter.pendingToken(weth, IGNAS_ADDRESS)).to.equal(ethers.parseEther("30"));
      // Nick: 3/10 = 30 WETH
      expect(await splitter.pendingToken(weth, NICK_ADDRESS)).to.equal(ethers.parseEther("30"));
      // Muscadine: 4/10 = 40 WETH
      expect(await splitter.pendingToken(weth, MUSCADINE_ADDRESS)).to.equal(
        ethers.parseEther("40"),
      );
    });
  });

  describe("Multi-Token Scenario", function () {
    it("should handle fees from all three vaults simultaneously", async function () {
      const usdcAmount = ethers.parseUnits("1000", 6);
      const cbbtcAmount = ethers.parseUnits("10", 8);
      const wethAmount = ethers.parseEther("100");

      await usdc.mint(owner.address, usdcAmount);
      await cbbtc.mint(owner.address, cbbtcAmount);
      await weth.mint(owner.address, wethAmount);

      await usdc.transfer(await splitter.getAddress(), usdcAmount);
      await cbbtc.transfer(await splitter.getAddress(), cbbtcAmount);
      await weth.transfer(await splitter.getAddress(), wethAmount);

      // Claim all tokens
      await splitter.claimAll(usdc);
      await splitter.claimAll(cbbtc);
      await splitter.claimAll(weth);

      // Verify all tokens were split correctly
      expect(await usdc.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseUnits("300", 6));
      expect(await cbbtc.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseUnits("3", 8));
      expect(await weth.balanceOf(IGNAS_ADDRESS)).to.equal(ethers.parseEther("30"));
    });
  });
});
