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
  ERC20FeeSplitter-V2/            # Future contract versions (ready for new contracts)
    mocks/
    test/
    scripts/
  mocks/                          # Shared mocks (used by multiple contracts)
    MockERC4626Vault.sol

flattened/                        # Flattened contracts for block explorer verification
  ERC20FeeSplitter/
    ERC20FeeSplitter-flattened.sol
```

**Note:** Flattened contracts are stored outside the `contracts/` directory to prevent Hardhat from compiling them alongside the source contracts.

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

### ERC20FeeSplitter

Ultra-minimal fee splitter smart contract for ERC20 tokens only.

**Features:**
- **Fully immutable** - NO owner, NO configuration changes, EVER
- **50/50 split** between Nick and Ignas (permanent)
- **ERC20 tokens only** - Supports any ERC20 including vault shares
- **Reentrancy protected** - Safe from attacks
- **Gas optimized** - Minimal functions, efficient code

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

# Create .env file
echo "PRIVATE_KEY=your_private_key_here" > .env
echo "BASESCAN_API_KEY=your_api_key_here" >> .env
```

### Deploy to Base Mainnet
```bash
npm run deploy:base
# or
npx hardhat run contracts/ERC20FeeSplitter/scripts/deployImmutable.ts --network base
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

**Alternative:** Use the flattened contract for verification:
```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> \
  --contract contracts/ERC20FeeSplitter/ERC20FeeSplitter.sol:ERC20FeeSplitter \
  "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333" \
  "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261" \
  "1" \
  "1"
```

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

**Test Coverage:** 34 tests covering all functionality including:
- 50/50 token splitting
- Deflationary tokens (fee-on-transfer)
- Rebasing tokens
- Reentrancy protection
- Edge cases and precision

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

6. (Optional) Create flattened contract for verification:
   ```bash
   mkdir -p flattened/YourNewContract
   npx hardhat flatten contracts/YourNewContract/YourNewContract.sol > flattened/YourNewContract/YourNewContract-flattened.sol
   ```

The repository is configured to automatically find and compile all contracts in the `contracts/` directory. Tests are discovered recursively in `contracts/**/test/` directories.

## Security

- **Immutable** - Configuration cannot be changed after deployment
- **No owner** - No admin functions or privileged access
- **Minimal code** - 111 lines, easy to audit
- **OpenZeppelin** - Uses industry-standard secure libraries
- **Reentrancy protection** - Uses OpenZeppelin's ReentrancyGuard

## Important

⚠️ **This contract is FULLY IMMUTABLE:**
- Configuration is PERMANENT
- Cannot change payees or shares
- If you need changes, deploy a new contract

## License

MIT License - see LICENSE file for details