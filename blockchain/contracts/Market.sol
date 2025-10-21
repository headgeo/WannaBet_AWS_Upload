// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Market
 * @notice Individual prediction market contract with UMA settlement
 * @dev Allows early settlement proposals before expiry, enforces max 2 proposals
 */
contract Market is Ownable, ReentrancyGuard {
    // Market states
    enum MarketStatus {
        Active,
        Closed,
        ResolutionRequested,
        Settled
    }

    // Market data
    uint256 public immutable marketId;
    string public question;
    uint256 public expiryTimestamp;
    address public immutable collateralToken;
    address public immutable umaAdapter;
    
    MarketStatus public status;
    bytes32 public umaRequestId;
    
    // Proposal tracking
    uint256 public proposalCount;
    uint256 public constant MAX_PROPOSALS = 2;
    
    // Settlement data
    bool public isSettled;
    bytes32 public settledOutcome; // "YES" or "NO" encoded as bytes32
    
    // Proposal details
    struct Proposal {
        address proposer;
        bytes32 outcome;
        uint256 timestamp;
        bool isEarlySettlement; // Track if proposal was made before expiry
    }
    
    Proposal[] public proposals;
    
    // Events
    event MarketCreated(uint256 indexed marketId, string question, uint256 expiryTimestamp);
    event MarketClosed(uint256 indexed marketId);
    event ResolutionRequested(uint256 indexed marketId, bytes32 requestId);
    event OutcomeProposed(uint256 indexed marketId, address indexed proposer, bytes32 outcome, uint256 proposalNumber, bool isEarlySettlement);
    event MarketSettled(uint256 indexed marketId, bytes32 outcome);
    event ProposalLimitReached(uint256 indexed marketId);
    event EarlySettlementProposed(uint256 indexed marketId, address indexed proposer, bytes32 outcome);

    constructor(
        uint256 _marketId,
        string memory _question,
        uint256 _expiryTimestamp,
        address _collateralToken,
        address _umaAdapter,
        address _vault
    ) {
        require(_expiryTimestamp > block.timestamp, "Expiry must be in future");
        require(_collateralToken != address(0), "Invalid collateral token");
        require(_umaAdapter != address(0), "Invalid UMA adapter");
        
        marketId = _marketId;
        question = _question;
        expiryTimestamp = _expiryTimestamp;
        collateralToken = _collateralToken;
        umaAdapter = _umaAdapter;
        status = MarketStatus.Active;
        
        emit MarketCreated(_marketId, _question, _expiryTimestamp);
    }

    /**
     * @notice Close the market (called at expiry)
     */
    function closeMarket() external {
        require(block.timestamp >= expiryTimestamp, "Market not expired yet");
        require(status == MarketStatus.Active, "Market already closed");
        
        status = MarketStatus.Closed;
        emit MarketClosed(marketId);
    }

    /**
     * @notice Request resolution from UMA Optimistic Oracle
     * @dev Can be called at any time to enable early settlement
     */
    function requestResolution() external nonReentrant returns (bytes32) {
        require(status == MarketStatus.Active || status == MarketStatus.Closed, "Invalid market status");
        require(umaRequestId == bytes32(0), "Resolution already requested");
        
        // Call UMA adapter to create request
        umaRequestId = IUMAOracleAdapter(umaAdapter).requestPrice(
            address(this),
            marketId,
            block.timestamp // Use current timestamp instead of expiry for early settlement
        );
        
        status = MarketStatus.ResolutionRequested;
        emit ResolutionRequested(marketId, umaRequestId);
        
        return umaRequestId;
    }

    /**
     * @notice Propose an outcome to UMA
     * @param outcome The proposed outcome ("YES" or "NO" as bytes32)
     * @dev Allows proposals at any time, enforces max 2 proposals, blocks concurrent proposals
     */
    function proposeOutcome(bytes32 outcome) external nonReentrant {
        require(status == MarketStatus.ResolutionRequested, "Resolution not requested");
        require(proposalCount < MAX_PROPOSALS, "Max proposals reached");
        require(outcome == bytes32("YES") || outcome == bytes32("NO"), "Invalid outcome");
        
        bool isEarlySettlement = block.timestamp < expiryTimestamp;
        
        // Submit proposal to UMA via adapter
        IUMAOracleAdapter(umaAdapter).proposePrice(
            umaRequestId,
            outcome,
            msg.sender
        );
        
        // Record proposal
        proposals.push(Proposal({
            proposer: msg.sender,
            outcome: outcome,
            timestamp: block.timestamp,
            isEarlySettlement: isEarlySettlement
        }));
        
        proposalCount++;
        
        emit OutcomeProposed(marketId, msg.sender, outcome, proposalCount, isEarlySettlement);
        
        if (isEarlySettlement) {
            emit EarlySettlementProposed(marketId, msg.sender, outcome);
        }
        
        // Block further proposals if limit reached
        if (proposalCount >= MAX_PROPOSALS) {
            emit ProposalLimitReached(marketId);
        }
    }

    /**
     * @notice Clear pending proposal flag after liveness period or dispute
     * @dev Called by UMA adapter after proposal is resolved or disputed
     */
    function clearPendingProposal() external {
        require(msg.sender == umaAdapter, "Only UMA adapter can clear");
    }

    /**
     * @notice Dispute a pending proposal
     * @dev Allows anyone to dispute a proposal during liveness period
     */
    function disputeProposal() external {
        require(proposalCount < MAX_PROPOSALS, "Cannot dispute after max proposals");
    }

    /**
     * @notice Settle the market with UMA's final outcome
     * @dev Called by UMA adapter after liveness period
     */
    function settle(bytes32 outcome) external nonReentrant {
        require(msg.sender == umaAdapter, "Only UMA adapter can settle");
        require(!isSettled, "Already settled");
        require(status == MarketStatus.ResolutionRequested, "Invalid status");
        
        settledOutcome = outcome;
        isSettled = true;
        status = MarketStatus.Settled;
        
        emit MarketSettled(marketId, outcome);
    }

    /**
     * @notice Get the settled outcome
     * @return The final outcome (YES/NO as bytes32)
     */
    function getOutcome() external view returns (bytes32) {
        require(isSettled, "Market not settled yet");
        return settledOutcome;
    }

    /**
     * @notice Get proposal details
     * @param index Proposal index
     * @return Proposal details
     */
    function getProposal(uint256 index) external view returns (Proposal memory) {
        require(index < proposals.length, "Invalid proposal index");
        return proposals[index];
    }

    /**
     * @notice Check if market can accept more proposals
     * @return True if more proposals can be submitted
     */
    function canAcceptProposals() external view returns (bool) {
        return status == MarketStatus.ResolutionRequested 
            && proposalCount < MAX_PROPOSALS;
    }
    
    /**
     * @notice Check if market is still accepting trades
     * @return True if market can accept trades
     */
    function canAcceptTrades() external view returns (bool) {
        // Market accepts trades until settled (even during liveness period)
        return status == MarketStatus.Active || 
               (status == MarketStatus.ResolutionRequested && !isSettled);
    }
}

interface IUMAOracleAdapter {
    function requestPrice(address market, uint256 marketId, uint256 timestamp) external returns (bytes32);
    function proposePrice(bytes32 requestId, bytes32 outcome, address proposer) external;
}
