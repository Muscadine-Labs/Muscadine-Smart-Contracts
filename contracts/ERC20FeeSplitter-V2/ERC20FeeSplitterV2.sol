// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title ERC20FeeSplitterV2
/// @notice Upgradeable fee splitter for ERC20 tokens with dynamic payee management
/// @dev Uses UUPS upgradeability pattern, supports multiple payees with configurable shares
///      Uses "actual-sent" accounting for ERC20 to support fee-on-transfer tokens
contract ERC20FeeSplitterV2 is 
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    using SafeERC20 for IERC20;

    // --- custom errors ---
    error InvalidPayee();
    error InvalidShares();
    error PayeeNotFound();
    error PayeeAlreadyExists();
    error NothingDue();
    error TokenTransferFailed();
    error NoPayees();

    // --- storage ---
    struct PayeeInfo {
        address payee;
        uint256 shares;
        bool exists;
    }

    mapping(address => PayeeInfo) public payees;
    address[] public payeeList;
    uint256 public totalShares;

    // --- mutable accounting ---
    mapping(IERC20 => mapping(address => uint256)) private _releasedERC20;
    mapping(IERC20 => uint256) private _totalReleasedERC20;

    // --- events ---
    event ERC20Claimed(IERC20 indexed token, address indexed to, uint256 amount);
    event PayeeAdded(address indexed payee, uint256 shares);
    event PayeeRemoved(address indexed payee);
    event PayeeUpdated(address indexed payee, uint256 oldShares, uint256 newShares);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @notice Initialize the contract with initial payees
    /// @param initialPayees Array of payee addresses
    /// @param initialShares Array of shares for each payee (must match length of initialPayees)
    /// @param owner_ Address that will own the contract
    function initialize(
        address[] memory initialPayees,
        uint256[] memory initialShares,
        address owner_
    ) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init(owner_);
        __UUPSUpgradeable_init();

        if (initialPayees.length == 0) revert NoPayees();
        if (initialPayees.length != initialShares.length) revert InvalidShares();

        uint256 total = 0;
        for (uint256 i = 0; i < initialPayees.length; i++) {
            if (initialPayees[i] == address(0)) revert InvalidPayee();
            if (initialShares[i] == 0) revert InvalidShares();
            if (payees[initialPayees[i]].exists) revert PayeeAlreadyExists();

            payees[initialPayees[i]] = PayeeInfo({
                payee: initialPayees[i],
                shares: initialShares[i],
                exists: true
            });
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

    // --- claim functions ---
    function claim(IERC20 token, address payee) external nonReentrant {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists) revert PayeeNotFound();

        uint256 amount = pendingToken(token, payee);
        if (amount == 0) revert NothingDue();

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

    function claimAll(IERC20 token) external nonReentrant {
        if (payeeList.length == 0) revert NoPayees();

        for (uint256 i = 0; i < payeeList.length; i++) {
            address payee = payeeList[i];
            uint256 amount = pendingToken(token, payee);
            
            if (amount > 0) {
                uint256 balanceBefore = token.balanceOf(address(this));
                token.safeTransfer(payee, amount);
                uint256 balanceAfter = token.balanceOf(address(this));
                
                if (balanceAfter < balanceBefore) {
                    uint256 sent = balanceBefore - balanceAfter;
                    _releasedERC20[token][payee] += sent;
                    _totalReleasedERC20[token] += sent;
                    emit ERC20Claimed(token, payee, sent);
                }
            }
        }
    }

    // --- owner functions ---
    function addPayee(address payee, uint256 shares) external onlyOwner {
        if (payee == address(0)) revert InvalidPayee();
        if (shares == 0) revert InvalidShares();
        if (payees[payee].exists) revert PayeeAlreadyExists();

        payees[payee] = PayeeInfo({
            payee: payee,
            shares: shares,
            exists: true
        });
        payeeList.push(payee);
        totalShares += shares;

        emit PayeeAdded(payee, shares);
    }

    function removePayee(address payee) external onlyOwner {
        PayeeInfo memory payeeInfo = payees[payee];
        if (!payeeInfo.exists) revert PayeeNotFound();

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

    function transferOwnership(address newOwner) public override onlyOwner {
        if (newOwner == address(0)) revert InvalidPayee();
        super.transferOwnership(newOwner);
    }

    // --- upgrade functions ---
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}

