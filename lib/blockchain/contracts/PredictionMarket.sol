// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uma/core/contracts/optimistic-oracle-v3/interfaces/OptimisticOracleV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PredictionMarket
 * @notice Simple binary (YES/NO) prediction market using UMA's Optimistic Oracle V3
 */
contract PredictionMarket {
    OptimisticOracleV3Interface public immutable oo;
    IERC20 public immutable currency;
    bytes32 public immutable defaultIdentifier;
    
    string public question;
    uint256 public expiryTime;
    uint256 public reward;
    bytes32 public assertionId;
    bool public settled;
    bool public outcome;
    
    event MarketInitialized(string question, uint256 expiryTime, uint256 reward);
    event OutcomeProposed(address indexed proposer, bytes32 assertionId, bool outcome);
    event MarketSettled(bool outcome);
    
    constructor(
        address _optimisticOracleV3,
        address _currency,
        string memory _question,
        uint256 _expiryTime,
        uint256 _reward
    ) {
        oo = OptimisticOracleV3Interface(_optimisticOracleV3);
        currency = IERC20(_currency);
        defaultIdentifier = oo.defaultIdentifier();
        
        question = _question;
        expiryTime = _expiryTime;
        reward = _reward;
        
        // Transfer reward from creator
        require(currency.transferFrom(msg.sender, address(this), _reward), "Reward transfer failed");
        
        emit MarketInitialized(_question, _expiryTime, _reward);
    }
    
    function proposeOutcome(bool _outcome, uint256 bond) external returns (bytes32) {
        require(block.timestamp >= expiryTime, "Market not yet expired");
        require(assertionId == bytes32(0), "Outcome already proposed");
        require(!settled, "Market already settled");
        
        // Build claim
        string memory outcomeText = _outcome ? "YES" : "NO";
        bytes memory claim = abi.encodePacked(
            'The outcome of market "', question, '" is ', outcomeText, '.'
        );
        
        // Approve bond and reward
        require(currency.transferFrom(msg.sender, address(this), bond), "Bond transfer failed");
        require(currency.approve(address(oo), bond + reward), "Approval failed");
        
        // Assert truth
        assertionId = oo.assertTruth(
            claim,
            msg.sender, // asserter
            address(this), // callbackRecipient
            address(0), // escalationManager
            7200, // 2 hour liveness
            currency,
            bond,
            defaultIdentifier,
            bytes32(0) // domain
        );
        
        outcome = _outcome;
        
        emit OutcomeProposed(msg.sender, assertionId, _outcome);
        
        return assertionId;
    }
    
    function settleMarket() external {
        require(assertionId != bytes32(0), "No assertion made");
        require(!settled, "Already settled");
        
        oo.settleAssertion(assertionId);
        settled = true;
        
        emit MarketSettled(outcome);
    }
    
    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external {
        require(msg.sender == address(oo), "Only OO can call");
        require(_assertionId == assertionId, "Invalid assertion");
        
        settled = true;
        
        if (!_assertedTruthfully) {
            // Assertion was disputed and found false
            outcome = !outcome;
        }
        
        emit MarketSettled(outcome);
    }
    
    function assertionDisputedCallback(bytes32 _assertionId) external {
        require(msg.sender == address(oo), "Only OO can call");
        // Handle dispute if needed
    }
}
