# Security Policy

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability in this project, please help us by reporting it responsibly.

### How to Report

**Please do NOT open a public GitHub issue.**

Instead, please report security vulnerabilities by emailing the maintainers directly. Include:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

### What to Expect

- We will acknowledge receipt of your vulnerability report within 48 hours
- We will provide a more detailed response within 7 days
- We will work on a fix and coordinate disclosure

## Supported Versions

| Version | Contract | Supported          |
| ------- | -------- | ------------------ |
| 1.0.x   | ERC20FeeSplitter (V1) | :white_check_mark: |
| 2.0.x   | ERC20FeeSplitterV2 (V2) | :white_check_mark: |

## Security Best Practices

When using these contracts:

1. **Audit Before Deployment**: Have the contract audited by professional security auditors
2. **Test Thoroughly**: Run comprehensive tests on testnets before mainnet deployment
3. **Start Small**: Begin with small amounts to verify correct operation
4. **Monitor Activity**: Set up monitoring for contract events and unusual activity
5. **Understand Upgradeability** (V2): Only the owner can upgrade the contract via UUPS
6. **Secure Keys**: Protect owner private keys with hardware wallets or multi-sig

## Contract-Specific Considerations

### ERC20FeeSplitter (V1)
- **Fully Immutable**: No owner, no upgrades, no configuration changes
- **Minimal Attack Surface**: Only essential functions, no admin controls
- **Simple and Secure**: 111 lines of code, easy to audit
- **No Privileged Access**: No one can modify the contract after deployment

### ERC20FeeSplitterV2 (V2)
- **UUPS Upgradeability**: Owner can upgrade the contract implementation
- **Owner Privileges**: Owner can add/remove/update payees and upgrade contract
- **Multi-Sig Required**: **Always use a multi-sig wallet as owner in production**
- **Storage Layout**: Must follow upgradeable storage layout rules when upgrading
- **Access Control**: Owner-only functions for management operations
- **Pull-Based Payments**: Payees must actively claim their tokens

## Dependencies

This project uses:
- **OpenZeppelin Contracts v5.4.0:**
  - `@openzeppelin/contracts`
  - `@openzeppelin/contracts-upgradeable`
- **Hardhat v2.27.0** - Development framework
- **@nomicfoundation/hardhat-toolbox v5.0.0** - Hardhat plugins

Always use the latest stable versions and monitor OpenZeppelin security advisories.

