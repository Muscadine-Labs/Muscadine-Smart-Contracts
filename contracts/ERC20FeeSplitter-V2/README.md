# ERC20FeeSplitterV2

Upgradeable fee splitter smart contract with dynamic payee management and owner controls.

## Overview

ERC20FeeSplitterV2 is an upgradeable version of the fee splitter that supports multiple payees, dynamic payee management, and owner-controlled upgrades. It uses the UUPS (Universal Upgradeable Proxy Standard) pattern for upgradeability while maintaining all the security features of V1.

**✅ Ready for Deployment:**
- All 33 tests passing
- No compilation errors
- Comprehensive documentation
- Deployment and upgrade scripts ready

## Features

- ✅ **Upgradeable** - UUPS proxy pattern, upgradeable by owner
- ✅ **Dynamic Payees** - Add, remove, and update payees and shares
- ✅ **Multiple Payees** - Supports any number of payees (not just 2)
- ✅ **Owner Controls** - Owner can manage payees and upgrade contract
- ✅ **ERC20 Compatible** - Supports any ERC20 token including vault shares
- ✅ **Reentrancy Protected** - Uses OpenZeppelin's ReentrancyGuard
- ✅ **Deflationary Token Support** - Uses "actual-sent" accounting
- ✅ **Comprehensive Tests** - 33 tests covering all functionality

## Contract Details

**Contract:** `ERC20FeeSplitterV2.sol`  
**License:** MIT  
**Solidity Version:** 0.8.24  
**Upgrade Pattern:** UUPS (Universal Upgradeable Proxy Standard)

### Initial Configuration

- **Payee 1 (Ignas):** `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261` (3 shares, 1.5%)
- **Payee 2 (Nick):** `0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333` (3 shares, 1.5%)
- **Payee 3 (Muscadine Labs):** `0x057fd8B961Eb664baA647a5C7A6e9728fabA266A` (4 shares, 2.0%)
- **Total Shares:** 10 (5% of total fees)
- **Owner:** Nick's wallet (default) or set via `OWNER_ADDRESS` env var

## Complete Function Reference

### READ Functions (View/Public)

| Function | Returns | Description |
|----------|---------|-------------|
| `pendingToken(IERC20 token, address payee)` | `uint256` | Calculate claimable amount for a payee and token |
| `getPayeeCount()` | `uint256` | Get total number of payees |
| `getPayeeInfo(address payee)` | `(uint256 shares, bool exists)` | Get payee shares and existence status |
| `getAllPayees()` | `address[]` | Get array of all payee addresses |
| `payees(address payee)` | `PayeeInfo` | Get payee struct (payee, shares, exists) |
| `payeeList(uint256 index)` | `address` | Get payee address by array index |
| `totalShares()` | `uint256` | Get total shares across all payees |
| `owner()` | `address` | Get contract owner address |

**Key Function: `pendingToken`**
```solidity
// Calculate how much a payee can claim
uint256 pending = splitter.pendingToken(usdcToken, ignasAddress);
// Returns: amount Ignas can claim in USDC
```

### WRITE Functions (Public)

| Function | Description | Security |
|----------|-------------|----------|
| `claim(IERC20 token, address payee)` | Claim tokens for one specific payee | `nonReentrant` |
| `claimAll(IERC20 token)` | Claim tokens for ALL payees at once | `nonReentrant` |

**Usage:**
```solidity
// Claim for one payee
splitter.claim(usdcToken, ignasAddress);

// Claim for all payees at once
splitter.claimAll(usdcToken);
```

**How it works:**
- Validates payee exists
- Calculates pending amount based on shares
- Transfers tokens using actual-sent accounting (handles deflationary tokens)
- Updates released amounts
- Emits `ERC20Claimed` event

### OWNER Functions (Owner Only)

| Function | Description | Access |
|----------|-------------|--------|
| `addPayee(address payee, uint256 shares)` | Add a new payee with specified shares | `onlyOwner` |
| `removePayee(address payee)` | Remove a payee (cannot remove last payee) | `onlyOwner` |
| `updatePayeeShares(address payee, uint256 newShares)` | Update shares for an existing payee | `onlyOwner` |
| `transferOwnership(address newOwner)` | Transfer ownership to a new address | `onlyOwner` |

**Usage:**
```solidity
// Add a new payee
splitter.addPayee(newPayeeAddress, 2);

// Update payee shares
splitter.updatePayeeShares(ignasAddress, 5);

// Remove a payee
splitter.removePayee(oldPayee);

// Transfer ownership to multi-sig
splitter.transferOwnership(multiSigAddress);
```

## Events

- `ERC20Claimed(IERC20 indexed token, address indexed to, uint256 amount)` - Emitted when tokens are claimed
- `PayeeAdded(address indexed payee, uint256 shares)` - Emitted when a new payee is added
- `PayeeRemoved(address indexed payee)` - Emitted when a payee is removed
- `PayeeUpdated(address indexed payee, uint256 oldShares, uint256 newShares)` - Emitted when payee shares are updated
- `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)` - Emitted when ownership is transferred

## Usage Examples

### Basic Usage

```solidity
// 1. Send tokens to splitter
token.transfer(splitterAddress, amount);

// 2. Check pending amount
uint256 pending = splitter.pendingToken(tokenAddress, payeeAddress);

// 3. Claim tokens
splitter.claim(tokenAddress, payeeAddress);
// or claim for all payees
splitter.claimAll(tokenAddress);
```

### Owner Management

```solidity
// Add payee
splitter.addPayee(newPayee, 2);

// Update shares
splitter.updatePayeeShares(payeeAddress, 5);

// Remove payee
splitter.removePayee(payeeAddress);
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
   OWNER_ADDRESS=0x... # Optional, defaults to Nick's wallet
   ```

### Deploy to Base Mainnet

```bash
npm run deploy:v2:base
```

Or manually:
```bash
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/deployV2.ts --network base
```

### Verify Contracts

After deployment, verify both the proxy and implementation:

```bash
# Verify proxy
npx hardhat verify --network base <PROXY_ADDRESS>

# Verify implementation
npx hardhat verify --network base <IMPLEMENTATION_ADDRESS>
```

## Upgrading

See [UPGRADE_GUIDE.md](./UPGRADE_GUIDE.md) for detailed upgrade instructions.

Quick upgrade:
```bash
# Set proxy address in .env
PROXY_ADDRESS=0xYourProxyAddress

# Run upgrade
npm run upgrade:v2:base
```

## Testing

```bash
# Run all V2 tests
npx hardhat test contracts/ERC20FeeSplitter-V2/test/

# Run specific test file
npx hardhat test contracts/ERC20FeeSplitter-V2/test/ERC20FeeSplitterV2.test.ts

# Run with gas reporting
REPORT_GAS=true npm test

# Run coverage
npm run test:coverage
```

### Test Coverage

**33 tests across 4 test files:**
- ✅ All V1 functionality (deflationary tokens, vault tokens, reentrancy)
- ✅ V2-specific features (payee management, ownership, upgrades)
- ✅ Edge cases and precision handling
- ✅ Security tests (reentrancy protection, access control)

**Coverage Areas:**
- Core functionality (token splitting, claims, pending calculations)
- Payee management (add/remove/update, duplicate prevention)
- Security (reentrancy, access control, input validation)
- Token compatibility (standard, deflationary, vault tokens, rebasing)
- Edge cases (zero amounts, precision, multiple claims)

## Ownership & Multi-Sig Setup

### Current Implementation

The contract uses OpenZeppelin's `OwnableUpgradeable`, which supports **a single owner address**.

### Recommended: Multi-Sig Wallet as Owner

**How it works:**
1. Deploy a multi-sig wallet (e.g., Gnosis Safe)
2. Set the multi-sig wallet address as the contract owner during deployment
3. The contract sees it as a single owner address
4. But the multi-sig wallet requires multiple signatures to execute any transaction

**Benefits:**
- ✅ **Security**: Requires multiple approvals for upgrades/changes
- ✅ **No contract changes needed**: Works with existing `OwnableUpgradeable`
- ✅ **Standard practice**: Used by most DeFi protocols
- ✅ **Flexible**: Can configure threshold (e.g., 2-of-3, 3-of-5)

### Setup Steps

1. **Create Multi-Sig Wallet**:
   - Go to https://safe.global
   - Create a new Safe on Base network
   - Add owners (e.g., Nick, Ignas, Muscadine Labs)
   - Set threshold (e.g., 2-of-3)
   - Deploy the Safe

2. **Deploy Contract**:
   ```typescript
   const MULTI_SIG_ADDRESS = "0x..."; // Your Safe address
   // Use MULTI_SIG_ADDRESS as owner in deployment
   ```

3. **Upgrade Process** (requires multi-sig approval):
   - Propose upgrade transaction in Safe
   - Get required number of approvals
   - Execute upgrade

### Owner Privileges

The contract owner has the following privileges:
- ✅ Upgrade the contract implementation (`_authorizeUpgrade`)
- ✅ Add new payees (`addPayee`)
- ✅ Remove payees (`removePayee`)
- ✅ Update payee shares (`updatePayeeShares`)
- ✅ Transfer ownership (`transferOwnership`)

**All of these require owner approval**, so using a multi-sig ensures multiple people must approve any changes.

### Security Best Practices

1. **Always use multi-sig for production** - Never use a single private key
2. **Use hardware wallets** - For multi-sig signers, use hardware wallets
3. **Set appropriate threshold** - Balance security vs. convenience (e.g., 2-of-3)
4. **Test on testnet first** - Deploy multi-sig and contract on testnet
5. **Document signers** - Keep track of who has signing authority

## Security

### Upgradeability

⚠️ **This contract is UPGRADEABLE:**
- Owner can upgrade the contract implementation
- Owner can add/remove/update payees
- **Use multi-sig wallet as owner in production!**

### Security Features

- ✅ **Reentrancy Protection** - All claim functions use `nonReentrant`
- ✅ **Access Control** - Owner-only functions protected by `onlyOwner`
- ✅ **Input Validation** - All functions validate inputs (zero address, shares > 0)
- ✅ **Actual-Sent Accounting** - Handles deflationary tokens correctly
- ✅ **Zero Address Checks** - Prevents invalid addresses
- ✅ **Division by Zero Protection** - Checks totalShares > 0
- ✅ **UUPS Pattern** - Secure upgradeability pattern
- ✅ **OpenZeppelin Libraries** - Industry-standard secure code

### Best Practices

1. **Use Multi-Sig for Owner** - Never use a single private key
2. **Test Upgrades on Testnet** - Always test upgrades before mainnet
3. **Audit Before Deployment** - Have contracts audited by professionals
4. **Monitor Activity** - Set up monitoring for contract events
5. **Secure Keys** - Use hardware wallets for owner accounts

## Differences from V1

| Feature | V1 | V2 |
|---------|----|----|
| Payees | Fixed 2 | Dynamic (any number) |
| Shares | Fixed 1:1 | Dynamic (configurable) |
| Owner | None (immutable) | Owner-controlled |
| Upgradeable | No | Yes (UUPS) |
| Payee Management | None | Add/Remove/Update |

## When to Use This Contract

Use ERC20FeeSplitterV2 when:
- ✅ You need to manage multiple payees (3+)
- ✅ You need to change payees or shares over time
- ✅ You want upgradeability for future improvements
- ✅ You need owner controls for management

**For simple, immutable 2-payee splitter, use [ERC20FeeSplitter](../ERC20FeeSplitter/README.md)**

## License

MIT License - see [LICENSE](../../LICENSE) file for details
