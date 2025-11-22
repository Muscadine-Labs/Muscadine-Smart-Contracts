// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DeflationaryMock
/// @notice Mock deflationary ERC20 token that burns 1% on every transfer
/// @dev Used to test proper handling of tokens with transfer fees/burns
contract DeflationaryMock is ERC20 {
    uint8 private immutable _DECIMALS;
    uint256 public constant BURN_RATE = 100; // 1% = 1/100

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _DECIMALS = decimals_;
    }

    /// @notice Mint tokens to any address (for testing only)
    /// @param to Address to mint tokens to
    /// @param amount Amount of tokens to mint
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Get the number of decimals for this token
    /// @return Number of decimals
    function decimals() public view virtual override returns (uint8) {
        return _DECIMALS;
    }

    /// @notice Override transfer to implement deflationary mechanism
    /// @dev Burns 1% of the transfer amount
    /// @param to Recipient address
    /// @param value Amount to transfer (before burn)
    /// @return success True if transfer succeeded
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        address owner = _msgSender();

        // Calculate burn amount (1%)
        uint256 burnAmount = value / BURN_RATE;
        uint256 transferAmount = value - burnAmount;

        // Burn 1%
        if (burnAmount > 0) {
            _burn(owner, burnAmount);
        }

        // Transfer remaining 99%
        _transfer(owner, to, transferAmount);

        return true;
    }

    /// @notice Override transferFrom to implement deflationary mechanism
    /// @dev Burns 1% of the transfer amount
    /// @param from Sender address
    /// @param to Recipient address
    /// @param value Amount to transfer (before burn)
    /// @return success True if transfer succeeded
    function transferFrom(address from, address to, uint256 value) public virtual override returns (bool) {
        address spender = _msgSender();
        _spendAllowance(from, spender, value);

        // Calculate burn amount (1%)
        uint256 burnAmount = value / BURN_RATE;
        uint256 transferAmount = value - burnAmount;

        // Burn 1%
        if (burnAmount > 0) {
            _burn(from, burnAmount);
        }

        // Transfer remaining 99%
        _transfer(from, to, transferAmount);

        return true;
    }
}
