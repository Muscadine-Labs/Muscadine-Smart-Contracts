# ERC20FeeSplitter

Ultra-minimal, fully immutable fee splitter smart contract for ERC20 tokens.

## Overview

ERC20FeeSplitter is a production-ready, fully immutable fee splitter contract designed for splitting ERC20 token fees between two payees. It's designed to be as simple and secure as possible with no owner, no upgrades, and no configuration changes after deployment.

## Features

- ✅ **Fully Immutable** - No owner, no upgrades, no configuration changes, EVER
- ✅ **50/50 Split** - Permanent split between Nick and Ignas (1:1 shares)
- ✅ **ERC20 Compatible** - Supports any ERC20 token including vault shares (Morpho, etc.)
- ✅ **Reentrancy Protected** - Uses OpenZeppelin's ReentrancyGuard
- ✅ **Deflationary Token Support** - Uses "actual-sent" accounting for fee-on-transfer tokens
- ✅ **Gas Optimized** - Minimal code (111 lines), efficient operations
- ✅ **Battle Tested** - Comprehensive test suite (31+ tests)

## Contract Details

**Contract:** `ERC20FeeSplitter.sol`  
**License:** MIT  
**Solidity Version:** 0.8.24

### Configuration

- **Payee 1 (Nick):** `0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333` (1 share)
- **Payee 2 (Ignas):** `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261` (1 share)
- **Total Shares:** 2 (50/50 split)

## Functions

### View Functions

| Function | Description |
|----------|-------------|
| `pendingToken(IERC20 token, address payee)` | Returns the claimable amount for a payee |
| `PAYEE1()` | Returns Nick's address |
| `PAYEE2()` | Returns Ignas's address |
| `SHARES1()` | Returns Nick's shares (1) |
| `SHARES2()` | Returns Ignas's shares (1) |
| `TOTAL_SHARES()` | Returns total shares (2) |

### Write Functions

| Function | Description |
|----------|-------------|
| `claim(IERC20 token, address payee)` | Claims tokens for one payee |
| `claimAll(IERC20 token)` | Claims tokens for both payees at once |

## Usage

### 1. Send Tokens to Splitter

```solidity
// Send tokens to the splitter contract
token.transfer(splitterAddress, amount);
```

### 2. Check Pending Amounts

```solidity
uint256 pending = splitter.pendingToken(tokenAddress, payeeAddress);
```

### 3. Claim Tokens

```solidity
// Claim for one payee
splitter.claim(tokenAddress, payeeAddress);

// Or claim for both payees at once
splitter.claimAll(tokenAddress);
```

## Deployment

### Prerequisites

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file (see `.env.example`):
   ```bash
   PRIVATE_KEY=your_private_key
   BASESCAN_API_KEY=your_api_key
   ```

### Deploy to Base Mainnet

```bash
npm run deploy:base
```

Or manually:
```bash
npx hardhat run contracts/ERC20FeeSplitter/scripts/deployImmutable.ts --network base
```

### Verify Contract

```bash
npx hardhat verify --network base <CONTRACT_ADDRESS> \
  "0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333" \
  "0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261" \
  "1" \
  "1"
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test contracts/ERC20FeeSplitter/test/FeeSplitterImmutable.test.ts

# Run with gas reporting
REPORT_GAS=true npm test

# Run coverage
npm run test:coverage
```

### Test Coverage

- ✅ 31+ tests covering all functionality
- ✅ Deflationary token support
- ✅ Vault token compatibility (USDC, cbBTC, WETH)
- ✅ Reentrancy protection
- ✅ Edge cases and precision

## Security

### Immutability

⚠️ **This contract is FULLY IMMUTABLE:**
- Configuration is set at deployment and **CANNOT** be changed
- No owner functions
- No upgrade mechanism
- If you need changes, you must deploy a new contract

### Security Features

- **Reentrancy Protection** - Uses OpenZeppelin's ReentrancyGuard
- **Actual-Sent Accounting** - Handles deflationary tokens correctly
- **Minimal Attack Surface** - Only essential functions
- **OpenZeppelin Libraries** - Industry-standard secure code

## Important Notes

1. **Permanent Configuration** - Payees and shares cannot be changed after deployment
2. **No Owner** - There is no owner address, no one can modify the contract
3. **Pull-Based** - Payees must actively claim their tokens
4. **Multi-Token Support** - Can handle multiple ERC20 tokens simultaneously

## When to Use This Contract

Use ERC20FeeSplitter when:
- ✅ You need a simple, immutable fee splitter
- ✅ You have exactly 2 payees with 50/50 split
- ✅ You don't need to change configuration
- ✅ You want maximum security through immutability

**For dynamic payees or upgradeability, use [ERC20FeeSplitterV2](../ERC20FeeSplitter-V2/README.md)**

## License

MIT License - see [LICENSE](../../LICENSE) file for details

