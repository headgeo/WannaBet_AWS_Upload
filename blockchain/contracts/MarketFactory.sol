// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./Market.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MarketFactory
 * @notice Factory contract for creating and tracking prediction markets
 */
contract MarketFactory is Ownable {
    address public immutable collateralVault;
    address public immutable umaAdapter;
    address public immutable collateralToken;
    
    uint256 public marketCount;
    
    // Mapping from market ID to Market contract address
    mapping(uint256 => address) public markets;
    
    // Array of all market addresses
    address[] public allMarkets;
    
    // Events
    event MarketCreated(
        uint256 indexed marketId,
        address indexed marketAddress,
        string question,
        uint256 expiryTimestamp,
        address creator
    );

    constructor(
        address _collateralVault,
        address _umaAdapter,
        address _collateralToken
    ) {
        require(_collateralVault != address(0), "Invalid vault address");
        require(_umaAdapter != address(0), "Invalid UMA adapter");
        require(_collateralToken != address(0), "Invalid collateral token");
        
        collateralVault = _collateralVault;
        umaAdapter = _umaAdapter;
        collateralToken = _collateralToken;
    }

    /**
     * @notice Create a new prediction market
     * @param question The market question
     * @param expiryTimestamp When the market expires
     * @return marketId The ID of the created market
     * @return marketAddress The address of the created market contract
     */
    function createMarket(
        string memory question,
        uint256 expiryTimestamp
    ) external returns (uint256 marketId, address marketAddress) {
        require(bytes(question).length > 0, "Question cannot be empty");
        require(expiryTimestamp > block.timestamp, "Expiry must be in future");
        
        marketId = marketCount++;
        
        // Deploy new Market contract
        Market market = new Market(
            marketId,
            question,
            expiryTimestamp,
            collateralToken,
            umaAdapter,
            msg.sender
        );
        
        marketAddress = address(market);
        markets[marketId] = marketAddress;
        allMarkets.push(marketAddress);
        
        emit MarketCreated(
            marketId,
            marketAddress,
            question,
            expiryTimestamp,
            msg.sender
        );
        
        return (marketId, marketAddress);
    }

    /**
     * @notice Get market address by ID
     * @param marketId The market ID
     * @return The market contract address
     */
    function getMarket(uint256 marketId) external view returns (address) {
        require(marketId < marketCount, "Market does not exist");
        return markets[marketId];
    }

    /**
     * @notice Get all market addresses
     * @return Array of all market addresses
     */
    function getAllMarkets() external view returns (address[] memory) {
        return allMarkets;
    }

    /**
     * @notice Get total number of markets created
     * @return Total market count
     */
    function getMarketCount() external view returns (uint256) {
        return marketCount;
    }
}
