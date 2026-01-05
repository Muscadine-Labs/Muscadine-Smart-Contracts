// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ERC20Mock
/// @notice Mock ERC20 token for testing with standard transfer behavior
/// @dev Allows anyone to mint for testing purposes
/// @author Muscadine Labs
contract ERC20Mock is ERC20 {
    uint8 private immutable _DECIMALS;

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
}
