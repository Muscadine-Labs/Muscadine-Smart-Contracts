# Muscadine Fee Splitter Contracts

Production-ready fee splitter smart contracts for ERC20 tokens.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Hardhat](https://img.shields.io/badge/Built%20with-Hardhat-yellow.svg)](https://hardhat.org/)

## Repository Structure

This repository is organized with each contract in its own folder, containing all related files:

```
contracts/
  ERC20FeeSplitter/              # ERC20 Fee Splitter Contract
    ERC20FeeSplitter.sol          # Main contract
    mocks/                        # Contract-specific mocks
      ERC20Mock.sol
      DeflationaryMock.sol
    test/                         # Test files
      AdvancedERC20FeeSplitter.test.ts
      FeeSplitterImmutable.test.ts
      VaultTokens.test.ts
    scripts/                      # Deployment scripts
      deployImmutable.ts
  ERC20FeeSplitter-V2/            # Upgradeable fee splitter with dynamic payees
    ERC20FeeSplitterV2.sol        # Main contract
    mocks/                         # Contract-specific mocks
      ERC20Mock.sol
      DeflationaryMock.sol
    test/                          # Test files
      ERC20FeeSplitterV2.test.ts
      V2Advanced.test.ts
      V2VaultTokens.test.ts
      V2DeflationaryTokens.test.ts
    scripts/                       # Deployment scripts
      deployV2.ts
      upgradeV2.ts
    README.md                      # Contract documentation
    UPGRADE_GUIDE.md               # Upgrade instructions
    OWNERSHIP.md                   # Ownership setup guide
    TEST_COVERAGE.md               # Test coverage details
  mocks/                          # Shared mocks (used by multiple contracts)
    MockERC4626Vault.sol

```

Each contract folder contains:
- The contract source code (`.sol` file)
- Contract-specific mocks (in `mocks/` subdirectory)
- Test files (in `test/` subdirectory)
- Deployment scripts (in `scripts/` subdirectory)

This organization makes it easy to:
- Add new contracts without conflicts
- Keep contract-related files together
- Maintain clear separation between contracts

## Contracts

### ERC20FeeSplitter (V1)

Ultra-minimal, fully immutable fee splitter smart contract for ERC20 tokens.

**Features:**
- **Fully immutable** - NO owner, NO configuration changes, EVER
- **50/50 split** between Nick and Ignas (permanent)
- **ERC20 tokens only** - Supports any ERC20 including vault shares
- **Reentrancy protected** - Safe from attacks
- **Gas optimized** - Minimal functions, efficient code

**Documentation:** See [contracts/ERC20FeeSplitter/README.md](./contracts/ERC20FeeSplitter/README.md)

### ERC20FeeSplitterV2 (V2)

Upgradeable fee splitter with dynamic payee management and owner controls.

**Features:**
- **Upgradeable** - UUPS proxy pattern, upgradeable by owner
- **Dynamic Payees** - Add, remove, and update payees and shares
- **Multiple Payees** - Supports 3+ payees (currently: Ignas, Nick, Muscadine Labs)
- **Owner Controls** - Owner can manage payees and upgrade contract
- **All V1 Features** - Deflationary tokens, vault tokens, reentrancy protection

**Initial Configuration:**
- Ignas: 3 shares (1.5%)
- Nick: 3 shares (1.5%)
- Muscadine Labs: 4 shares (2.0%)
- Total: 10 shares (5% of fees)

**Documentation:** See [contracts/ERC20FeeSplitter-V2/README.md](./contracts/ERC20FeeSplitter-V2/README.md)

## Configuration

**Payees:**
- Nick: `0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333`
- Ignas: `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261`
- Split: 50/50 (1:1 shares)

## Usage

### 1. Send Tokens
```solidity
token.transfer(splitterAddress, amount);
```

### 2. Claim Tokens
```solidity
// Claim for one payee
splitter.claim(tokenAddress, payeeAddress);

// Claim for both payees
splitter.claimAll(tokenAddress);
```

### 3. Check Pending Amounts
```solidity
uint256 pending = splitter.pendingToken(tokenAddress, payeeAddress);
```

## Contract Functions

| Function | Type | Purpose |
|----------|------|---------|
| `constructor` | Deploy | Initialize with payees and shares |
| `pendingToken` | Read | Check claimable amount |
| `claim` | Write | Claim for one payee |
| `claimAll` | Write | Claim for both payees |
| `PAYEE1()` | Read | Get Nick's address |
| `PAYEE2()` | Read | Get Ignas's address |
| `SHARES1()` | Read | Get Nick's shares |
| `SHARES2()` | Read | Get Ignas's shares |
| `TOTAL_SHARES()` | Read | Get total shares (2) |

## Deployment

### Setup
```bash
# Install dependencies
npm install

# Create .env file from example
cp .env.example .env

# Edit .env and add your actual values:
# - PRIVATE_KEY: Your deployment wallet private key
# - BASESCAN_API_KEY: Your Basescan API key
# - OWNER_ADDRESS: (Optional) For V2, defaults to Nick's wallet
```

### Deploy V1 (Immutable) to Base Mainnet
```bash
npm run deploy:base
# or
npx hardhat run contracts/ERC20FeeSplitter/scripts/deployImmutable.ts --network base
```

### Deploy V2 (Upgradeable) to Base Mainnet
```bash
npm run deploy:v2:base
# or
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/deployV2.ts --network base
```

**Note:** The deployment script is located in each contract's `scripts/` folder. For ERC20FeeSplitter, use `contracts/ERC20FeeSplitter/scripts/deployImmutable.ts`.

### Verify Contract
```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> \
  "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333" \
  "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261" \
  "1" \
  "1"
```

**Note:** Hardhat's verification plugin automatically handles contract verification. No flattened contracts are needed.

## Testing

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run coverage
npm run test:coverage

# Run specific test file
npx hardhat test contracts/ERC20FeeSplitter/test/AdvancedERC20FeeSplitter.test.ts

# Run tests for a specific contract
npx hardhat test contracts/ERC20FeeSplitter/test/
```

**Note:** 
- Gas reports are generated to `gas-report.txt` when `REPORT_GAS=true`
- Coverage reports are generated to `coverage/` directory
- All test files are located in `contracts/<ContractName>/test/` directories

**Test Coverage:**
- **V1:** 31+ tests covering immutable contract functionality
- **V2:** 33 tests covering upgradeable contract + all V1 functionality
- Deflationary tokens (fee-on-transfer)
- Vault tokens (USDC, cbBTC, WETH with different decimals)
- Rebasing tokens
- Reentrancy protection
- Edge cases and precision
- Dynamic payee management (V2 only)

## Scripts

### V1 Scripts

**Claim All Tokens:**
```bash
CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npm run claim:v1:base
```

### V2 Scripts

V2 includes comprehensive scripts for contract management. See [contracts/ERC20FeeSplitter-V2/README.md](./contracts/ERC20FeeSplitter-V2/README.md#scripts) for full documentation.

**Quick Reference:**
- **Check Pending:** `CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npm run check:v2:base`
- **Claim All:** `CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npm run claim:v2:base`
- **Manage Payees:** `CONTRACT_ADDRESS=0x... ACTION=add PAYEE=0x... SHARES=2 npm run manage:v2:base`
- **Transfer Owner:** `CONTRACT_ADDRESS=0x... NEW_OWNER=0x... npm run transfer-owner:v2:base`
- **Upgrade:** `PROXY_ADDRESS=0x... npm run upgrade:v2:base`

**Environment Variables:** See `.env.example` for all required variables.

## Development

### Adding a New Contract

When adding a new contract, follow this structure:

1. Create a new folder under `contracts/`:
   ```bash
   mkdir -p contracts/YourNewContract/{mocks,test,scripts}
   ```

2. Add your contract file:
   ```bash
   # contracts/YourNewContract/YourNewContract.sol
   ```

3. Add contract-specific mocks to `contracts/YourNewContract/mocks/`

4. Add tests to `contracts/YourNewContract/test/`
   - Test files should use `*.test.ts` naming
   - Import types from `../../../typechain-types` (adjust path as needed)

5. Add deployment scripts to `contracts/YourNewContract/scripts/`

The repository is configured to automatically find and compile all contracts in the `contracts/` directory. Tests are discovered recursively in `contracts/**/test/` directories.

**Note:** Contract verification is handled automatically by Hardhat's verification plugin. No flattened contracts are needed.

## Security

### ERC20FeeSplitter (V1)
- **Immutable** - Configuration cannot be changed after deployment
- **No owner** - No admin functions or privileged access
- **Minimal code** - 111 lines, easy to audit
- **OpenZeppelin** - Uses industry-standard secure libraries
- **Reentrancy protection** - Uses OpenZeppelin's ReentrancyGuard

⚠️ **V1 is FULLY IMMUTABLE:**
- Configuration is PERMANENT
- Cannot change payees or shares
- If you need changes, deploy a new contract

### ERC20FeeSplitterV2 (V2)
- **Upgradeable** - Owner can upgrade implementation (use multi-sig!)
- **Owner Controls** - Owner can manage payees and upgrade
- **Access Control** - Owner-only functions for management
- **UUPS Pattern** - Secure upgradeability pattern
- **All V1 Security** - Reentrancy protection, OpenZeppelin libraries

⚠️ **V2 is UPGRADEABLE:**
- Owner has significant privileges
- **Use multi-sig wallet as owner in production**
- Can upgrade contract, add/remove payees, update shares
- See [SECURITY.md](./SECURITY.md) for detailed security practices

See [SECURITY.md](./SECURITY.md) for comprehensive security information.

## License

MIT License - see LICENSE file for details