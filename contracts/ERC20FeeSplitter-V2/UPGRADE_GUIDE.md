# ERC20FeeSplitterV2 Upgrade Guide

This contract uses the **UUPS (Universal Upgradeable Proxy Standard)** pattern, which allows the contract implementation to be upgraded while maintaining the same proxy address.

## How Upgrades Work

### Architecture

```
┌─────────────┐
│   Proxy     │  ← Users interact with this address (never changes)
│  (Storage)  │
└──────┬──────┘
       │
       │ points to
       ▼
┌─────────────┐
│Implementation│  ← This can be upgraded (code changes)
│   (Logic)    │
└─────────────┘
```

- **Proxy Address**: The address users interact with. This **never changes**.
- **Implementation Address**: The actual contract code. This **can be upgraded**.

### Key Points

1. **Storage is preserved**: All state (payees, shares, balances) stays in the proxy
2. **Code can change**: New functions, bug fixes, optimizations can be added
3. **Only owner can upgrade**: Requires `onlyOwner` modifier
4. **No data migration needed**: Storage layout must remain compatible

## Upgrade Process

### Step 1: Prepare New Implementation

1. Make your changes to `ERC20FeeSplitterV2.sol`
2. **Important**: Don't change storage variable order or types (breaks compatibility)
3. You can:
   - Add new functions
   - Fix bugs
   - Optimize gas
   - Add new storage variables at the end

### Step 2: Compile and Test

```bash
# Compile the new version
npm run build

# Run tests to ensure everything works
npm test
```

### Step 3: Deploy Upgrade

```bash
# Set your proxy address in .env
echo "PROXY_ADDRESS=0xYourProxyAddressHere" >> .env

# Run the upgrade script
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base
```

### Step 4: Verify New Implementation

```bash
# Get the new implementation address from the upgrade output
npx hardhat verify --network base <NEW_IMPLEMENTATION_ADDRESS>
```

## Example: Adding a New Function

### Before (V2.0)

```solidity
contract ERC20FeeSplitterV2 {
    // ... existing code ...
    
    function claim(IERC20 token, address payee) external { ... }
}
```

### After (V2.1) - Add new function

```solidity
contract ERC20FeeSplitterV2 {
    // ... existing code (unchanged) ...
    
    function claim(IERC20 token, address payee) external { ... }
    
    // NEW: Add emergency pause function
    bool public paused;
    
    function pause() external onlyOwner {
        paused = true;
    }
    
    function unpause() external onlyOwner {
        paused = false;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
}
```

### Upgrade Steps

1. Add the new code
2. Compile: `npm run build`
3. Test: `npm test`
4. Upgrade: `npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base`
5. Verify: `npx hardhat verify --network base <NEW_IMPLEMENTATION>`

## Storage Layout Rules

⚠️ **CRITICAL**: When upgrading, you **MUST** follow these rules:

### ✅ Safe Changes

- Add new variables at the **end** of storage
- Add new functions
- Modify function logic (not storage layout)
- Fix bugs

### ❌ Breaking Changes (DON'T DO)

- Change order of existing storage variables
- Change types of existing storage variables
- Remove storage variables
- Insert new variables in the middle

### Example: Safe Storage Addition

```solidity
// V2.0
contract ERC20FeeSplitterV2 {
    mapping(address => PayeeInfo) public payees;  // Slot 0
    address[] public payeeList;                    // Slot 1
    uint256 public totalShares;                    // Slot 2
}

// V2.1 - SAFE: Adding at the end
contract ERC20FeeSplitterV2 {
    mapping(address => PayeeInfo) public payees;  // Slot 0 (unchanged)
    address[] public payeeList;                    // Slot 1 (unchanged)
    uint256 public totalShares;                    // Slot 2 (unchanged)
    bool public paused;                            // Slot 3 (NEW - safe!)
}
```

## Upgrade Script Usage

### Basic Upgrade

```bash
# Set proxy address
export PROXY_ADDRESS=0xYourProxyAddress

# Run upgrade
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base
```

### With .env File

```bash
# .env
PROXY_ADDRESS=0xYourProxyAddress
PRIVATE_KEY=your_private_key
BASESCAN_API_KEY=your_api_key

# Run upgrade
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base
```

## Verification After Upgrade

1. **Check implementation address changed**:
   ```bash
   npx hardhat verify --network base <NEW_IMPLEMENTATION_ADDRESS>
   ```

2. **Test contract functions**:
   - Call existing functions to ensure they still work
   - Test new functions if added
   - Verify state is preserved

3. **Monitor events**:
   - Check that events still fire correctly
   - Verify no unexpected behavior

## Security Considerations

1. **Use Multi-Sig for Owner**: Never use a single private key for owner
2. **Test on Testnet First**: Always test upgrades on testnet
3. **Audit Changes**: Have upgrades audited before mainnet
4. **Backup State**: Save current state before upgrading
5. **Timelock Consideration**: Consider adding timelock for upgrades

## Troubleshooting

### "OwnableUnauthorizedAccount" Error

- Only the owner can upgrade
- Check you're using the owner account
- Verify owner address: `await contract.owner()`

### Storage Layout Mismatch

- If you get storage errors, you likely changed storage layout incorrectly
- Revert changes and follow storage layout rules
- Consider using storage gaps for future-proofing

### Upgrade Fails

- Check you have enough gas
- Verify proxy address is correct
- Ensure contract compiles without errors
- Check network connectivity

## Example: Complete Upgrade Workflow

```bash
# 1. Make changes to ERC20FeeSplitterV2.sol
# (add new function, fix bug, etc.)

# 2. Compile
npm run build

# 3. Test locally
npm test

# 4. Deploy to testnet first
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base-sepolia

# 5. Test on testnet
# (interact with contract, verify functions work)

# 6. Deploy to mainnet
npx hardhat run contracts/ERC20FeeSplitter-V2/scripts/upgradeV2.ts --network base

# 7. Verify implementation
npx hardhat verify --network base <NEW_IMPLEMENTATION_ADDRESS>

# 8. Monitor and test
# (verify all functions work, check events, etc.)
```

## Additional Resources

- [OpenZeppelin UUPS Documentation](https://docs.openzeppelin.com/upgrades-plugins/1.x/proxies)
- [Storage Layout Guide](https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable)
- [Hardhat Upgrades Plugin](https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify)

