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
        address payee;
        uint256 shares;
        bool exists;
    }

    mapping(address => PayeeInfo) public payees;
    address[] public payeeList;
    uint256 public totalShares;

    // --- owner management ---
    mapping(address => bool) public owners;
    address[] public ownerList;

    // --- mutable accounting ---
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    mapping(IERC20 => uint256) private _totalReleasedERC20;
    IERC20[] private _trackedTokens;
    mapping(IERC20 => bool) private _isTrackedToken;
    IERC20[] private _claimableTokens;
    mapping(IERC20 => bool) private _isClaimableToken;

    // --- events ---
    event ERC20Claimed(IERC20 indexed token, address indexed to, uint256 amount);
    event PayeeAdded(address indexed payee, uint256 shares);
    event PayeeRemoved(address indexed payee);
    event PayeeUpdated(address indexed payee, uint256 oldShares, uint256 newShares);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event ClaimableTokenAdded(IERC20 indexed token);
    event ClaimableTokenRemoved(IERC20 indexed token);

    /// @notice Constructor - Initialize the contract with initial payees and owners
    /// @param initialPayees Array of payee addresses
    /// @param initialShares Array of shares for each payee (must match length of initialPayees)
    /// @param initialOwners Array of owner addresses (must have at least one owner)
    constructor(
        address[] memory initialPayees,
        uint256[] memory initialShares,
        address[] memory initialOwners
    ) {
        if (initialOwners.length == 0) revert NoOwners(); // Must have at least one owner
        if (initialPayees.length == 0) revert NoPayees();
        if (initialPayees.length != initialShares.length) revert InvalidShares();

        // Initialize owners
        for (uint256 i = 0; i < initialOwners.length; i++) {
            if (initialOwners[i] == address(0)) revert InvalidPayee();
            if (owners[initialOwners[i]]) revert OwnerAlreadyExists();
            owners[initialOwners[i]] = true;
            ownerList.push(initialOwners[i]);
            emit OwnerAdded(initialOwners[i]);
        }

        // Initialize payees
        uint256 total = 0;
        for (uint256 i = 0; i < initialPayees.length; i++) {
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
    function pendingToken(IERC20 token, address payee) public view returns (uint256) {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists || payeeInfo.shares == 0 || totalShares == 0) return 0;

        uint256 totalReceived = token.balanceOf(address(this)) + _totalReleasedERC20[token];
        uint256 due = (totalReceived * payeeInfo.shares) / totalShares;
        uint256 released = _releasedERC20[token][payee];
        return due > released ? due - released : 0;
    }

    function getPayeeCount() public view returns (uint256) {
        return payeeList.length;
    }

    function getPayeeInfo(address payee) public view returns (uint256 shares, bool exists) {
        PayeeInfo memory info = payees[payee];
        return (info.shares, info.exists);
    }

    function getAllPayees() public view returns (address[] memory) {
        return payeeList;
    }

    function getOwnerCount() public view returns (uint256) {
        return ownerList.length;
    }

    function getAllOwners() public view returns (address[] memory) {
        return ownerList;
    }

    function isOwner(address account) public view returns (bool) {
        return owners[account];
    }

    // --- modifiers ---
    modifier onlyOwner() {
        if (!owners[msg.sender]) revert NotOwner();
        _;
    }

    // --- claim functions ---
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

    function claimAll() external nonReentrant {
        if (payeeList.length == 0) revert NoPayees();
        if (_claimableTokens.length == 0) revert NoClaimableTokens();

        for (uint256 t = 0; t < _claimableTokens.length; t++) {
            IERC20 token = _claimableTokens[t];
            _trackToken(token);

            for (uint256 i = 0; i < payeeList.length; i++) {
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

    function claimAllForToken(IERC20 token) external nonReentrant {
        if (payeeList.length == 0) revert NoPayees();
        if (!_isClaimableToken[token]) revert ClaimableTokenNotFound();

        _trackToken(token);

        for (uint256 i = 0; i < payeeList.length; i++) {
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
    function addPayee(address payee, uint256 shares) external onlyOwner {
        if (payee == address(0)) revert InvalidPayee();
        if (shares == 0) revert InvalidShares();
        if (payees[payee].exists) revert PayeeAlreadyExists();

        payees[payee] = PayeeInfo({payee: payee, shares: shares, exists: true});
        payeeList.push(payee);
        totalShares += shares;

        emit PayeeAdded(payee, shares);
    }

    function removePayee(address payee) external onlyOwner {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists) revert PayeeNotFound();

        // Clean accounting for the removed payee across all tracked tokens
        uint256 tokenCount = _trackedTokens.length;
        for (uint256 i = 0; i < tokenCount; i++) {
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
        for (uint256 i = 0; i < length; i++) {
            if (payeeList[i] == payee) {
                payeeList[i] = payeeList[length - 1];
                payeeList.pop();
                break;
            }
        }

        if (payeeList.length == 0) revert NoPayees();

        emit PayeeRemoved(payee);
    }

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
    function addOwner(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidPayee();
        if (owners[newOwner]) revert OwnerAlreadyExists();

        owners[newOwner] = true;
        ownerList.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    function removeOwner(address ownerToRemove) external onlyOwner {
        if (!owners[ownerToRemove]) revert OwnerNotFound();
        if (ownerList.length == 1) revert CannotRemoveLastOwner();

        delete owners[ownerToRemove];

        // Remove from array
        uint256 length = ownerList.length;
        for (uint256 i = 0; i < length; i++) {
            if (ownerList[i] == ownerToRemove) {
                ownerList[i] = ownerList[length - 1];
                ownerList.pop();
                break;
            }
        }

        emit OwnerRemoved(ownerToRemove);
    }

    // --- claimable token management ---
    function addClaimableToken(IERC20 token) external onlyOwner {
        if (address(token) == address(0)) revert InvalidToken();
        if (_isClaimableToken[token]) revert ClaimableTokenAlreadyExists();

        _isClaimableToken[token] = true;
        _claimableTokens.push(token);

        emit ClaimableTokenAdded(token);
    }

    function removeClaimableToken(IERC20 token) external onlyOwner {
        if (!_isClaimableToken[token]) revert ClaimableTokenNotFound();

        delete _isClaimableToken[token];

        uint256 length = _claimableTokens.length;
        for (uint256 i = 0; i < length; i++) {
            if (_claimableTokens[i] == token) {
                _claimableTokens[i] = _claimableTokens[length - 1];
                _claimableTokens.pop();
                break;
            }
        }

        emit ClaimableTokenRemoved(token);
    }

    function getClaimableTokens() external view returns (IERC20[] memory) {
        return _claimableTokens;
    }

    // --- internal helpers ---
    function _trackToken(IERC20 token) private {
        if (!_isTrackedToken[token]) {
            _isTrackedToken[token] = true;
            _trackedTokens.push(token);
        }
    }
}
