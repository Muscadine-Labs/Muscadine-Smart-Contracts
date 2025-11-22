// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ERC20FeeSplitter
/// @notice Ultra-minimal, fully immutable pull-based splitter for ERC20 tokens only.
///         No owner, no upgrades, no configuration changes - set once at deployment, fixed forever.
/// @dev Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens.
///      Supports splitting any ERC20 token, including vault share tokens (e.g., Morpho vault shares).
contract ERC20FeeSplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- custom errors ---
    error InvalidPayee();
    error InvalidShares();
    error DuplicatePayee();
    error NotPayee();
    error NothingDue();
    error TokenTransferFailed();

    // --- immutable storage ---
    uint256 public immutable TOTAL_SHARES;
    address public immutable PAYEE1;
    address public immutable PAYEE2;
    uint256 public immutable SHARES1;
    uint256 public immutable SHARES2;

    // --- mutable accounting ---
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    mapping(IERC20 => uint256) private _totalReleasedERC20;

    // --- events ---
    event ERC20Claimed(IERC20 indexed token, address indexed to, uint256 amount);

    constructor(address payee1_, address payee2_, uint256 shares1_, uint256 shares2_) {
        if (payee1_ == address(0) || payee2_ == address(0)) revert InvalidPayee();
        if (shares1_ == 0 || shares2_ == 0) revert InvalidShares();
        if (payee1_ == payee2_) revert DuplicatePayee();

        PAYEE1 = payee1_;
        PAYEE2 = payee2_;
        SHARES1 = shares1_;
        SHARES2 = shares2_;
        TOTAL_SHARES = shares1_ + shares2_;
    }

    // --- views ---
    function pendingToken(IERC20 token, address a) public view returns (uint256) {
        uint256 share = a == PAYEE1 ? SHARES1 : (a == PAYEE2 ? SHARES2 : 0);
        if (share == 0) return 0;

        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * share) / TOTAL_SHARES;
        uint256 rel = _releasedERC20[token][a];
        return due > rel ? due - rel : 0;
    }

    // --- claim ---
    function claim(IERC20 token, address payee) external nonReentrant {
        if (payee != PAYEE1 && payee != PAYEE2) revert NotPayee();
        uint256 amount = pendingToken(token, payee);
        if (amount == 0) revert NothingDue();

        // actual-sent accounting (handles deflationary tokens)
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransfer(payee, amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter >= balanceBefore) revert TokenTransferFailed(); // avoids underflow, handles 0-sent and positive rebase
        uint256 sent = balanceBefore - balanceAfter;

        _releasedERC20[token][payee] += sent;
        _totalReleasedERC20[token] += sent;

        emit ERC20Claimed(token, payee, sent);
    }


    function claimAll(IERC20 token) external nonReentrant {
        // Claim for PAYEE1
        uint256 amount1 = pendingToken(token, PAYEE1);
        if (amount1 > 0) {
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransfer(PAYEE1, amount1);
            uint256 balanceAfter = token.balanceOf(address(this));
            if (balanceAfter < balanceBefore) {
                uint256 sent1 = balanceBefore - balanceAfter;
                _releasedERC20[token][PAYEE1] += sent1;
                _totalReleasedERC20[token] += sent1;
                emit ERC20Claimed(token, PAYEE1, sent1);
            }
        }

        // Claim for PAYEE2
        uint256 amount2 = pendingToken(token, PAYEE2);
        if (amount2 > 0) {
            uint256 balanceBefore = token.balanceOf(address(this));
            token.safeTransfer(PAYEE2, amount2);
            uint256 balanceAfter = token.balanceOf(address(this));
            if (balanceAfter < balanceBefore) {
                uint256 sent2 = balanceBefore - balanceAfter;
                _releasedERC20[token][PAYEE2] += sent2;
                _totalReleasedERC20[token] += sent2;
                emit ERC20Claimed(token, PAYEE2, sent2);
            }
        }
    }
}
