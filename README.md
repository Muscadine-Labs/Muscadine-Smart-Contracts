# Muscadine Fee Splitter Contracts

Production-ready fee splitter smart contracts for ERC20 tokens.

## Contracts

- **ERC20FeeSplitter (V1)**: Fully immutable fee splitter
- **ERC20FeeSplitterV2 (V2)**: Upgradeable fee splitter with dynamic payee management

## Setup

```bash
npm install
```

### Environment Variables

Create a `.env` file:

```env
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=your_rpc_url_here
BASESCAN_API_KEY=your_api_key_here
```

## Usage

```bash
npm test
npm run deploy:base      # Deploy V1 to Base
npm run deploy:v2:base   # Deploy V2 to Base
```

## Contact

**Main Contact:** muscadinelabs@gmail.com  
**Security:** muscadinelabs@gmail.com

## License

MIT License
