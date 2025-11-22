# Contract Verification on Basescan

## Quick Answer

**After deployment:**
- ✅ Contract appears on Basescan immediately (you can see the transaction)
- ❌ "Read Contract" and "Write Contract" tabs won't appear until you verify
- ✅ After verification, you can call all functions from Basescan

## Step-by-Step Verification

### Step 1: Deploy the Contract

```bash
npm run deploy:v2:base
```

The deployment script will output:
```
Proxy address:        0x...
Implementation address: 0x...
```

### Step 2: Verify Implementation Contract

```bash
npx hardhat verify --network base <IMPLEMENTATION_ADDRESS>
```

This verifies the actual contract code.

### Step 3: Verify Proxy Contract

```bash
npx hardhat verify --network base <PROXY_ADDRESS>
```

This enables the "Read Contract" and "Write Contract" tabs on Basescan.

### Step 4: Use Basescan Interface

After verification:
1. Go to `https://basescan.org/address/<PROXY_ADDRESS>`
2. Click on the **"Contract"** tab
3. You'll see:
   - **"Read Contract"** tab - All view functions (pendingToken, getPayeeCount, etc.)
   - **"Write Contract"** tab - All write functions (claim, claimAll, addPayee, etc.)
   - **"Code"** tab - Verified source code

## What You Can Do After Verification

### Read Functions (No Gas Required)
- Check pending amounts: `pendingToken(tokenAddress, payeeAddress)`
- Get payee count: `getPayeeCount()`
- Get payee info: `getPayeeInfo(payeeAddress)`
- Get all payees: `getAllPayees()`
- Check owner: `owner()`
- Check total shares: `totalShares()`

### Write Functions (Requires Gas)
- Claim tokens: `claim(tokenAddress, payeeAddress)`
- Claim all: `claimAll(tokenAddress)`
- Add payee (owner only): `addPayee(payeeAddress, shares)`
- Remove payee (owner only): `removePayee(payeeAddress)`
- Update shares (owner only): `updatePayeeShares(payeeAddress, newShares)`
- Transfer ownership (owner only): `transferOwnership(newOwner)`

## Troubleshooting

### "Contract Not Verified" Error
- Make sure you verified both proxy and implementation
- Wait a few minutes after verification (Basescan needs to index)
- Try refreshing the page

### Functions Not Showing
- Ensure you verified the **proxy address** (not just implementation)
- Check that verification was successful (should see green checkmark)
- Clear browser cache and refresh

### Can't Call Functions
- Make sure you're connected to Base network in your wallet
- Ensure you have enough ETH for gas fees
- For owner functions, make sure you're using the owner wallet

## Alternative: Manual Verification

If automatic verification fails, you can verify manually on Basescan:

1. Go to `https://basescan.org/address/<PROXY_ADDRESS>`
2. Click **"Contract"** tab
3. Click **"Verify and Publish"**
4. Fill in:
   - Compiler: `0.8.24`
   - License: `MIT`
   - Optimization: `Yes` (200 runs)
   - Enter the flattened contract code
5. Click **"Verify and Publish"**

## Important Notes

- **Always use the PROXY address** for interactions (not the implementation address)
- The proxy address never changes, even after upgrades
- After upgrades, you may need to verify the new implementation
- Keep your `BASESCAN_API_KEY` in `.env` for automatic verification

