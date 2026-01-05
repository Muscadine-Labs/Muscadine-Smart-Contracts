# ERC20FeeSplitterV2 (V2)

Fee splitter contract with dynamic payee management and owner controls.

## Features

- Dynamic payees - Add, remove, and update payees
- Owner controls - Owner can manage payees and shares
- Deflationary token support
- Reentrancy protected
- Not upgradeable

## Deployment

```bash
npm run deploy:v2:base
```

## Scripts

```bash
npm run claim:v2:base
npm run manage:v2:base
npm run tokens:v2:base
npm run transfer-owner:v2:base
```

## Testing

```bash
npm test
```
