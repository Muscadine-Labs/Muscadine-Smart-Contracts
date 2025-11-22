# ERC20FeeSplitterV2

Fee splitter smart contract with dynamic payee management and owner controls.

## Overview

ERC20FeeSplitterV2 is a fee splitter that supports multiple payees and dynamic payee management. Owners can add, remove, and update payees and their shares. The contract is deployed directly (non-upgradeable) and supports multiple owners for access control.

**✅ Ready for Deployment:**
- All 33 tests passing
- No compilation errors
- Comprehensive documentation
- Deployment and upgrade scripts ready

## Features

- ✅ **Dynamic Payees** - Add, remove, and update payees and shares
- ✅ **Multiple Payees** - Supports any number of payees (not just 2)
- ✅ **Owner Controls** - Owner can manage payees and shares (upgrades disabled)
- ✅ **ERC20 Compatible** - Supports any ERC20 token including vault shares
- ✅ **Reentrancy Protected** - Uses OpenZeppelin's ReentrancyGuard
- ✅ **Deflationary Token Support** - Uses "actual-sent" accounting
- ✅ **Comprehensive Tests** - 33 tests covering all functionality
- ⚠️ **Not Upgradeable** - Contract cannot be upgraded after deployment

## Contract Details

**Contract:** `ERC20FeeSplitterV2.sol`  
**License:** MIT  
**Solidity Version:** 0.8.24  
**Deployment Pattern:** Direct deployment (non-upgradeable)

### Deployed Contract

**Base Mainnet:** `0x3690Eb8735fE51c695d2f2Da289D1FA447137E24`  
**Basescan:** https://basescan.org/address/0x3690Eb8735fE51c695d2f2Da289D1FA447137E24

### Initial Configuration

- **Payee 1 (Ignas):** `0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261` (3 shares, 1.5%)
- **Payee 2 (Nick):** `0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333` (3 shares, 1.5%)
- **Payee 3 (Muscadine Labs):** `0x057fd8B961Eb664baA647a5C7A6e9728fabA266A` (4 shares, 2.0%)
- **Total Shares:** 10 (5% of total fees)
- **Owners:** Nick (`0xf35B121bA32cBeaA27716abEfFb6B65a55f9B333`) + Ignas (`0x0D5A708B651FeE1DAA0470431c4262ab3e1D0261`)

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
| `getOwnerCount()` | `uint256` | Get total number of owners |
| `getAllOwners()` | `address[]` | Get array of all owner addresses |
| `isOwner(address account)` | `bool` | Check if an address is an owner |
| `owners(address account)` | `bool` | Check if an address is an owner (mapping) |

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
| `addOwner(address newOwner)` | Add a new owner | `onlyOwner` |
| `removeOwner(address ownerToRemove)` | Remove an owner (cannot remove last owner) | `onlyOwner` |

**Usage:**
```solidity
// Add a new payee
splitter.addPayee(newPayeeAddress, 2);

// Update payee shares
splitter.updatePayeeShares(ignasAddress, 5);

// Remove a payee
splitter.removePayee(oldPayee);

// Add a new owner
splitter.addOwner(newOwnerAddress);

// Remove an owner
splitter.removeOwner(ownerToRemove);
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

2. Create `.env` file:
   ```bash
   PRIVATE_KEY=your_private_key
   BASE_RPC_URL=https://base-rpc.publicnode.com
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

### Verify Contracts on Basescan

**Important:** After deployment, the contract will appear on Basescan, but you need to verify it to use the "Read Contract" and "Write Contract" tabs.

You need to verify **both** the proxy and implementation contracts:

```bash
# 1. Verify the implementation contract first
npx hardhat verify --network base <IMPLEMENTATION_ADDRESS>

# 2. Verify the proxy contract (this enables Read/Write Contract tabs)
npx hardhat verify --network base <PROXY_ADDRESS>
```

**After verification:**
- ✅ You'll see the contract source code on Basescan
- ✅ "Read Contract" tab will appear with all view functions
- ✅ "Write Contract" tab will appear with all write functions
- ✅ You can interact with the contract directly from Basescan

**Note:** The proxy address is what users interact with. After verification, you can call all functions from Basescan using the proxy address.

## Important: Upgrades Disabled

⚠️ **This contract cannot be upgraded.** The upgrade functionality has been permanently disabled. The contract is immutable after deployment.

If you need to make changes, you must deploy a new contract.

## Scripts

The V2 contract includes several utility scripts for common operations:

### Check Pending Amounts

View pending token amounts for all payees without claiming:

```bash
CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npm run check:v2:base
```

**Environment Variables:**
- `CONTRACT_ADDRESS` - Proxy address of the deployed contract
- `TOKEN_ADDRESS` - ERC20 token address to check

**What it shows:**
- All payees and their shares
- Pending amount for each payee
- Total pending across all payees
- Contract balance

---

### Claim All Tokens

Claim tokens for all payees at once:

```bash
CONTRACT_ADDRESS=0x... TOKEN_ADDRESS=0x... npm run claim:v2:base
```

**Environment Variables:**
- `CONTRACT_ADDRESS` - Proxy address of the deployed contract
- `TOKEN_ADDRESS` - ERC20 token address to claim

**What it does:**
- Shows pending amounts before claiming
- Claims tokens for all payees
- Shows claimed amounts after transaction

**Note:** Anyone can run this script (not just owner or payees)

---

### Manage Payees (Owner Only)

Add, remove, or update payees and their shares:

**Add Payee:**
```bash
CONTRACT_ADDRESS=0x... ACTION=add PAYEE=0x... SHARES=2 npm run manage:v2:base
```

**Remove Payee:**
```bash
CONTRACT_ADDRESS=0x... ACTION=remove PAYEE=0x... npm run manage:v2:base
```

**Update Payee Shares:**
```bash
CONTRACT_ADDRESS=0x... ACTION=update PAYEE=0x... SHARES=5 npm run manage:v2:base
```

**Environment Variables:**
- `CONTRACT_ADDRESS` - Proxy address of the deployed contract
- `ACTION` - "add", "remove", or "update"
- `PAYEE` - Payee address (required for all actions)
- `SHARES` - Number of shares (required for add/update actions)

**Requirements:**
- Must be run by the contract owner
- Cannot remove the last payee
- Shares must be > 0

---

### Transfer Ownership (Owner Only)

Transfer contract ownership to a new address (e.g., multi-sig wallet):

```bash
CONTRACT_ADDRESS=0x... NEW_OWNER=0x... npm run transfer-owner:v2:base
```

**Environment Variables:**
- `CONTRACT_ADDRESS` - Proxy address of the deployed contract
- `NEW_OWNER` - Address of the new owner

**Requirements:**
- Must be run by the current owner
- New owner cannot be zero address
- For production, use a multi-sig wallet address

---


### Script Summary

| Script | Command | Access | Required Env Vars |
|--------|---------|--------|-------------------|
| Check Pending | `npm run check:v2:base` | Anyone | `CONTRACT_ADDRESS`, `TOKEN_ADDRESS` |
| Claim All | `npm run claim:v2:base` | Anyone | `CONTRACT_ADDRESS`, `TOKEN_ADDRESS` |
| Manage Payees | `npm run manage:v2:base` | Owner | `CONTRACT_ADDRESS`, `ACTION`, `PAYEE`, `SHARES` (if add/update) |
| Transfer Owner | `npm run transfer-owner:v2:base` | Owner | `CONTRACT_ADDRESS`, `NEW_OWNER` |

**All scripts can also be run directly:**
```bash
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/<script-name>.ts --network base
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

## Ownership & Multi-Owner System

### Current Implementation

The contract uses a **custom multi-owner system** that supports **multiple owner addresses**. This provides flexibility and security without requiring a separate multi-sig wallet contract.

**Key Features:**
- Multiple owners can be added/removed dynamically
- At least one owner must always exist (cannot remove the last owner)
- All owners have equal privileges
- Owners can manage payees and other owners

### Recommended: Multi-Sig Wallet as Owner

**How it works:**
1. Deploy a multi-sig wallet (e.g., Gnosis Safe)
2. Set the multi-sig wallet address as one of the initial owners during deployment
3. Optionally add additional owners (individual addresses or other multi-sigs)
4. The multi-sig wallet requires multiple signatures to execute any transaction

**Benefits:**
- ✅ **Security**: Requires multiple approvals for changes
- ✅ **Flexibility**: Can have multiple owners (multi-sigs or individual addresses)
- ✅ **Standard practice**: Used by most DeFi protocols
- ✅ **Flexible**: Can configure threshold per multi-sig (e.g., 2-of-3, 3-of-5)

### Setup Steps

1. **Create Multi-Sig Wallet** (Optional but Recommended):
   - Go to https://safe.global
   - Create a new Safe on Base network
   - Add owners (e.g., Nick, Ignas, Muscadine Labs)
   - Set threshold (e.g., 2-of-3)
   - Deploy the Safe

2. **Deploy Contract**:
   ```typescript
   const MULTI_SIG_ADDRESS = "0x..."; // Your Safe address
   const OWNER_ADDRESSES = [MULTI_SIG_ADDRESS, "0x..."]; // Can have multiple owners
   // Use OWNER_ADDRESSES array in deployment
   ```

3. **Manage Owners**:
   - Add owners: `splitter.addOwner(newOwnerAddress)`
   - Remove owners: `splitter.removeOwner(ownerToRemove)` (cannot remove last owner)

### Owner Privileges

The contract owner has the following privileges:
- ✅ Add new payees (`addPayee`)
- ✅ Remove payees (`removePayee`)
- ✅ Update payee shares (`updatePayeeShares`)
- ✅ Add/remove owners (`addOwner`, `removeOwner`)

**Note:** Upgrades are disabled - the owner cannot upgrade the contract implementation.

**All owner functions require owner approval**, so using a multi-sig ensures multiple people must approve any changes.

### Security Best Practices

1. **Always use multi-sig for production** - Never use a single private key
2. **Use hardware wallets** - For multi-sig signers, use hardware wallets
3. **Set appropriate threshold** - Balance security vs. convenience (e.g., 2-of-3)
4. **Test on testnet first** - Deploy multi-sig and contract on testnet
5. **Document signers** - Keep track of who has signing authority

## Security

### Immutability

⚠️ **This contract is NOT upgradeable:**
- Contract implementation cannot be changed after deployment
- Owner can only manage payees and shares
- **Use multi-sig wallet as owner in production!**

### Security Features

- ✅ **Reentrancy Protection** - All claim functions use `nonReentrant`
- ✅ **Access Control** - Owner-only functions protected by `onlyOwner`
- ✅ **Input Validation** - All functions validate inputs (zero address, shares > 0)
- ✅ **Actual-Sent Accounting** - Handles deflationary tokens correctly
- ✅ **Zero Address Checks** - Prevents invalid addresses
- ✅ **Division by Zero Protection** - Checks totalShares > 0
- ✅ **OpenZeppelin Libraries** - Industry-standard secure code
- ✅ **Upgrades Disabled** - Contract cannot be upgraded after deployment

### Best Practices

1. **Use Multi-Sig for Owner** - Never use a single private key
2. **Audit Before Deployment** - Have contracts audited by professionals
3. **Monitor Activity** - Set up monitoring for contract events
4. **Secure Keys** - Use hardware wallets for owner accounts
5. **Test on Testnet First** - Always test on testnet before mainnet deployment

## Differences from V1

| Feature | V1 | V2 |
|---------|----|----|
| Payees | Fixed 2 | Dynamic (any number) |
| Shares | Fixed 1:1 | Dynamic (configurable) |
| Owner | None (immutable) | Owner-controlled (payee management only) |
| Upgradeable | No | No (upgrades disabled) |
| Payee Management | None | Add/Remove/Update |

## When to Use This Contract

Use ERC20FeeSplitterV2 when:
- ✅ You need to manage multiple payees (3+)
- ✅ You need to change payees or shares over time
- ✅ You need owner controls for payee management
- ✅ You want a contract that cannot be upgraded (immutable implementation)

**For simple, immutable 2-payee splitter, use [ERC20FeeSplitter](../ERC20FeeSplitter/README.md)**

## License

MIT License - see [LICENSE](../../LICENSE) file for details
