// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ERC20FeeSplitterV2
/// @notice Fee splitter for ERC20 tokens with dynamic payee management
/// @dev Supports multiple payees with configurable shares
///      Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens
///      Supports multiple owners for access control
/// @author Muscadine Labs
contract ERC20FeeSplitterV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // --- custom errors ---
    error InvalidPayee();
    error InvalidShares();
    error PayeeNotFound();
    error PayeeAlreadyExists();
    error NothingDue();
    error TokenTransferFailed();
    error NoPayees();
    error NotOwner();
    error OwnerNotFound();
    error OwnerAlreadyExists();
    error CannotRemoveLastOwner();
    error NoOwners();
    error NoClaimableTokens();
    error ClaimableTokenAlreadyExists();
    error ClaimableTokenNotFound();
    error InvalidToken();

    // --- storage ---
    struct PayeeInfo {
        bool exists;
        address payee;
        uint256 shares;
    }

    /// @notice Mapping of payee addresses to their info
    mapping(address => PayeeInfo) public payees;
    /// @notice Array of all payee addresses
    address[] public payeeList;
    /// @notice Total shares across all payees
    uint256 public totalShares;

    // --- owner management ---
    /// @notice Mapping of owner addresses
    mapping(address => bool) public owners;
    /// @notice Array of all owner addresses
    address[] public ownerList;

    // --- mutable accounting ---
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    mapping(IERC20 => uint256) private _totalReleasedERC20;
    IERC20[] private _trackedTokens;
    mapping(IERC20 => bool) private _isTrackedToken;
    IERC20[] private _claimableTokens;
    mapping(IERC20 => bool) private _isClaimableToken;

    // --- events ---
    /// @notice Emitted when tokens are claimed
    /// @param token The ERC20 token that was claimed
    /// @param to The address that received the tokens
    /// @param amount The amount of tokens claimed
    event ERC20Claimed(IERC20 indexed token, address indexed to, uint256 amount);
    /// @notice Emitted when a payee is added
    /// @param payee The payee address that was added
    /// @param shares The shares allocated to the payee
    event PayeeAdded(address indexed payee, uint256 indexed shares);
    /// @notice Emitted when a payee is removed
    /// @param payee The payee address that was removed
    event PayeeRemoved(address indexed payee);
    /// @notice Emitted when payee shares are updated
    /// @param payee The payee address
    /// @param oldShares The previous shares amount
    /// @param newShares The new shares amount
    event PayeeUpdated(address indexed payee, uint256 indexed oldShares, uint256 indexed newShares);
    /// @notice Emitted when an owner is added
    /// @param owner The owner address that was added
    event OwnerAdded(address indexed owner);
    /// @notice Emitted when an owner is removed
    /// @param owner The owner address that was removed
    event OwnerRemoved(address indexed owner);
    /// @notice Emitted when a claimable token is added
    /// @param token The ERC20 token address that was added
    event ClaimableTokenAdded(IERC20 indexed token);
    /// @notice Emitted when a claimable token is removed
    /// @param token The ERC20 token address that was removed
    event ClaimableTokenRemoved(IERC20 indexed token);

    /// @notice Constructor - Initialize the contract with initial payees and owners
    /// @param initialPayees Array of payee addresses
    /// @param initialShares Array of shares for each payee (must match length of initialPayees)
    /// @param initialOwners Array of owner addresses (must have at least one owner)
    constructor(address[] memory initialPayees, uint256[] memory initialShares, address[] memory initialOwners) {
        if (initialOwners.length == 0) revert NoOwners(); // Must have at least one owner
        if (initialPayees.length == 0) revert NoPayees();
        if (initialPayees.length != initialShares.length) revert InvalidShares();

        // Initialize owners
        for (uint256 i = 0; i < initialOwners.length; ++i) {
            if (initialOwners[i] == address(0)) revert InvalidPayee();
            if (owners[initialOwners[i]]) revert OwnerAlreadyExists();
            owners[initialOwners[i]] = true;
            ownerList.push(initialOwners[i]);
            emit OwnerAdded(initialOwners[i]);
        }

        // Initialize payees
        uint256 total = 0;
        for (uint256 i = 0; i < initialPayees.length; ++i) {
            if (initialPayees[i] == address(0)) revert InvalidPayee();
            if (initialShares[i] == 0) revert InvalidShares();
            if (payees[initialPayees[i]].exists) revert PayeeAlreadyExists();

            payees[initialPayees[i]] = PayeeInfo({payee: initialPayees[i], shares: initialShares[i], exists: true});
            payeeList.push(initialPayees[i]);
            total += initialShares[i];

            emit PayeeAdded(initialPayees[i], initialShares[i]);
        }

        totalShares = total;
    }

    // --- views ---
    /// @notice Calculate the pending token amount for a payee
    /// @param token The ERC20 token to check
    /// @param payee The payee address
    /// @return The amount of tokens the payee can claim
    function pendingToken(IERC20 token, address payee) public view returns (uint256) {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists || payeeInfo.shares == 0 || totalShares == 0) return 0;

        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * payeeInfo.shares) / totalShares;
        uint256 released = _releasedERC20[token][payee];
        return due > released ? due - released : 0;
    }

    /// @notice Get the total number of payees
    /// @return The number of payees
    function getPayeeCount() public view returns (uint256) {
        return payeeList.length;
    }

    /// @notice Get payee information
    /// @param payee The payee address
    /// @return shares The shares allocated to the payee
    /// @return exists Whether the payee exists
    function getPayeeInfo(address payee) public view returns (uint256 shares, bool exists) {
        PayeeInfo memory info = payees[payee];
        return (info.shares, info.exists);
    }

    /// @notice Get all payee addresses
    /// @return Array of all payee addresses
    function getAllPayees() public view returns (address[] memory) {
        return payeeList;
    }

    /// @notice Get the total number of owners
    /// @return The number of owners
    function getOwnerCount() public view returns (uint256) {
        return ownerList.length;
    }

    /// @notice Get all owner addresses
    /// @return Array of all owner addresses
    function getAllOwners() public view returns (address[] memory) {
        return ownerList;
    }

    /// @notice Check if an address is an owner
    /// @param account The address to check
    /// @return Whether the address is an owner
    function isOwner(address account) public view returns (bool) {
        return owners[account];
    }

    // --- modifiers ---
    modifier onlyOwner() {
        if (!owners[msg.sender]) revert NotOwner();
        _;
    }

    // --- claim functions ---
    /// @notice Claim tokens for a specific payee
    /// @param token The ERC20 token to claim
    /// @param payee The payee address to claim for
    function claim(IERC20 token, address payee) external nonReentrant {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists) revert PayeeNotFound();

        uint256 amount = pendingToken(token, payee);
        if (amount == 0) revert NothingDue();

        _trackToken(token);

        // actual-sent accounting (handles deflationary tokens)
        uint256 balanceBefore = token.balanceOf(address(this));
        token.safeTransfer(payee, amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter >= balanceBefore) revert TokenTransferFailed();
        uint256 sent = balanceBefore - balanceAfter;

        _releasedERC20[token][payee] += sent;
        _totalReleasedERC20[token] += sent;

        emit ERC20Claimed(token, payee, sent);
    }

    /// @notice Claim configured tokens for all payees
    function claimAll() external nonReentrant {
        if (payeeList.length == 0) revert NoPayees();
        if (_claimableTokens.length == 0) revert NoClaimableTokens();

        for (uint256 t = 0; t < _claimableTokens.length; ++t) {
            IERC20 token = _claimableTokens[t];
            _trackToken(token);

            for (uint256 i = 0; i < payeeList.length; ++i) {
                address payee = payeeList[i];
                uint256 amount = pendingToken(token, payee);

                if (amount == 0) continue;

                uint256 balanceBefore = token.balanceOf(address(this));
                if (balanceBefore == 0) break;

                uint256 payout = amount <= balanceBefore ? amount : balanceBefore;
                if (payout == 0) continue;

                token.safeTransfer(payee, payout);

                uint256 balanceAfter = token.balanceOf(address(this));
                if (balanceAfter >= balanceBefore) revert TokenTransferFailed();

                uint256 sent = balanceBefore - balanceAfter;
                if (sent == 0) continue;

                _releasedERC20[token][payee] += sent;
                _totalReleasedERC20[token] += sent;
                emit ERC20Claimed(token, payee, sent);
            }
        }
    }

    /// @notice Claim a specific token for all payees
    /// @param token The ERC20 token to claim
    function claimAllForToken(IERC20 token) external nonReentrant {
        if (payeeList.length == 0) revert NoPayees();
        if (!_isClaimableToken[token]) revert ClaimableTokenNotFound();

        _trackToken(token);

        for (uint256 i = 0; i < payeeList.length; ++i) {
            address payee = payeeList[i];
            uint256 amount = pendingToken(token, payee);

            if (amount == 0) continue;

            uint256 balanceBefore = token.balanceOf(address(this));
            if (balanceBefore == 0) break;

            uint256 payout = amount <= balanceBefore ? amount : balanceBefore;
            if (payout == 0) continue;

            token.safeTransfer(payee, payout);

            uint256 balanceAfter = token.balanceOf(address(this));
            if (balanceAfter >= balanceBefore) revert TokenTransferFailed();

            uint256 sent = balanceBefore - balanceAfter;
            if (sent == 0) continue;

            _releasedERC20[token][payee] += sent;
            _totalReleasedERC20[token] += sent;
            emit ERC20Claimed(token, payee, sent);
        }
    }

    // --- owner functions ---
    /// @notice Add a new payee
    /// @param payee The payee address to add
    /// @param shares The shares to allocate to the payee
    function addPayee(address payee, uint256 shares) external onlyOwner {
        if (payee == address(0)) revert InvalidPayee();
        if (shares == 0) revert InvalidShares();
        if (payees[payee].exists) revert PayeeAlreadyExists();

        payees[payee] = PayeeInfo({payee: payee, shares: shares, exists: true});
        payeeList.push(payee);
        totalShares += shares;

        emit PayeeAdded(payee, shares);
    }

    /// @notice Remove a payee
    /// @param payee The payee address to remove
    function removePayee(address payee) external onlyOwner {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists) revert PayeeNotFound();

        // Clean accounting for the removed payee across all tracked tokens
        uint256 tokenCount = _trackedTokens.length;
        for (uint256 i = 0; i < tokenCount; ++i) {
            IERC20 token = _trackedTokens[i];
            uint256 released = _releasedERC20[token][payee];
            if (released > 0) {
                _totalReleasedERC20[token] -= released;
                delete _releasedERC20[token][payee];
            }
        }

        // Remove from mapping
        delete payees[payee];
        totalShares -= payeeInfo.shares;

        // Remove from array
        uint256 length = payeeList.length;
        for (uint256 i = 0; i < length; ++i) {
            if (payeeList[i] == payee) {
                payeeList[i] = payeeList[length - 1];
                payeeList.pop();
                break;
            }
        }

        if (payeeList.length == 0) revert NoPayees();

        emit PayeeRemoved(payee);
    }

    /// @notice Update shares for a payee
    /// @param payee The payee address
    /// @param newShares The new shares amount
    function updatePayeeShares(address payee, uint256 newShares) external onlyOwner {
        PayeeInfo storage payeeInfo = payees[payee];
        if (!payeeInfo.exists) revert PayeeNotFound();
        if (newShares == 0) revert InvalidShares();

        uint256 oldShares = payeeInfo.shares;
        totalShares = totalShares - oldShares + newShares;
        payeeInfo.shares = newShares;

        emit PayeeUpdated(payee, oldShares, newShares);
    }

    // --- owner management functions ---
    /// @notice Add a new owner
    /// @param newOwner The owner address to add
    function addOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidPayee();
        if (owners[newOwner]) revert OwnerAlreadyExists();

        owners[newOwner] = true;
        ownerList.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    /// @notice Remove an owner
    /// @param ownerToRemove The owner address to remove
    function removeOwner(address ownerToRemove) external onlyOwner {
        if (!owners[ownerToRemove]) revert OwnerNotFound();
        if (ownerList.length == 1) revert CannotRemoveLastOwner();

        delete owners[ownerToRemove];

        // Remove from array
        uint256 length = ownerList.length;
        for (uint256 i = 0; i < length; ++i) {
            if (ownerList[i] == ownerToRemove) {
                ownerList[i] = ownerList[length - 1];
                ownerList.pop();
                break;
            }
        }

        emit OwnerRemoved(ownerToRemove);
    }

    // --- claimable token management ---
    /// @notice Add a claimable token
    /// @param token The ERC20 token address to add
    function addClaimableToken(IERC20 token) external onlyOwner {
        if (address(token) == address(0)) revert InvalidToken();
        if (_isClaimableToken[token]) revert ClaimableTokenAlreadyExists();

        _isClaimableToken[token] = true;
        _claimableTokens.push(token);

        emit ClaimableTokenAdded(token);
    }

    /// @notice Remove a claimable token
    /// @param token The ERC20 token address to remove
    function removeClaimableToken(IERC20 token) external onlyOwner {
        if (!_isClaimableToken[token]) revert ClaimableTokenNotFound();

        delete _isClaimableToken[token];

        uint256 length = _claimableTokens.length;
        for (uint256 i = 0; i < length; ++i) {
            if (_claimableTokens[i] == token) {
                _claimableTokens[i] = _claimableTokens[length - 1];
                _claimableTokens.pop();
                break;
            }
        }

        emit ClaimableTokenRemoved(token);
    }

    /// @notice Get all claimable tokens
    /// @return Array of claimable token addresses
    function getClaimableTokens() external view returns (IERC20[] memory) {
        return _claimableTokens;
    }

    // --- internal helpers ---
    /// @notice Track a token if not already tracked
    /// @param token The ERC20 token to track
    function _trackToken(IERC20 token) private {
        if (!_isTrackedToken[token]) {
            _isTrackedToken[token] = true;
            _trackedTokens.push(token);
        }
    }
}
