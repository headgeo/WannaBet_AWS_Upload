// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CollateralVault
 * @notice Holds user deposits and manages collateral for prediction markets
 * @dev Non-custodial vault where users maintain control of their funds
 */
contract CollateralVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable collateralToken;
    
    // User balances
    mapping(address => uint256) public balances;
    
    // Reserved balances per market per user
    mapping(uint256 => mapping(address => uint256)) public reservedBalances;
    
    // Authorized market contracts
    mapping(address => bool) public authorizedMarkets;
    
    // Events
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Reserved(uint256 indexed marketId, address indexed user, uint256 amount);
    event Released(uint256 indexed marketId, address indexed user, uint256 amount);
    event PayoutProcessed(uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketAuthorized(address indexed market);
    event MarketDeauthorized(address indexed market);

    constructor(address _collateralToken) {
        require(_collateralToken != address(0), "Invalid token address");
        collateralToken = IERC20(_collateralToken);
    }

    /**
     * @notice Deposit collateral tokens into the vault
     * @param amount Amount of tokens to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        collateralToken.safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender] += amount;
        
        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw available collateral tokens from the vault
     * @param amount Amount of tokens to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(balances[msg.sender] >= amount, "Insufficient balance");
        
        balances[msg.sender] -= amount;
        collateralToken.safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Reserve collateral for a market position
     * @param marketId ID of the market
     * @param user User whose collateral to reserve
     * @param amount Amount to reserve
     */
    function reserveForMarket(
        uint256 marketId,
        address user,
        uint256 amount
    ) external onlyAuthorizedMarket {
        require(balances[user] >= amount, "Insufficient balance");
        
        balances[user] -= amount;
        reservedBalances[marketId][user] += amount;
        
        emit Reserved(marketId, user, amount);
    }

    /**
     * @notice Release reserved collateral back to user's available balance
     * @param marketId ID of the market
     * @param user User whose collateral to release
     * @param amount Amount to release
     */
    function releaseReserved(
        uint256 marketId,
        address user,
        uint256 amount
    ) external onlyAuthorizedMarket {
        require(reservedBalances[marketId][user] >= amount, "Insufficient reserved balance");
        
        reservedBalances[marketId][user] -= amount;
        balances[user] += amount;
        
        emit Released(marketId, user, amount);
    }

    /**
     * @notice Process payout to winner
     * @param marketId ID of the market
     * @param user User to pay out
     * @param amount Amount to pay out
     */
    function payoutWinner(
        uint256 marketId,
        address user,
        uint256 amount
    ) external onlyAuthorizedMarket {
        require(reservedBalances[marketId][user] >= amount, "Insufficient reserved balance");
        
        reservedBalances[marketId][user] -= amount;
        balances[user] += amount;
        
        emit PayoutProcessed(marketId, user, amount);
    }

    /**
     * @notice Get available balance for a user
     * @param user User address
     * @return Available balance
     */
    function getAvailableBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    /**
     * @notice Get reserved balance for a user in a specific market
     * @param marketId Market ID
     * @param user User address
     * @return Reserved balance
     */
    function getReservedBalance(uint256 marketId, address user) external view returns (uint256) {
        return reservedBalances[marketId][user];
    }

    /**
     * @notice Authorize a market contract to manage collateral
     * @param market Market contract address
     */
    function authorizeMarket(address market) external onlyOwner {
        require(market != address(0), "Invalid market address");
        authorizedMarkets[market] = true;
        emit MarketAuthorized(market);
    }

    /**
     * @notice Deauthorize a market contract
     * @param market Market contract address
     */
    function deauthorizeMarket(address market) external onlyOwner {
        authorizedMarkets[market] = false;
        emit MarketDeauthorized(market);
    }

    modifier onlyAuthorizedMarket() {
        require(authorizedMarkets[msg.sender], "Not authorized market");
        _;
    }
}
