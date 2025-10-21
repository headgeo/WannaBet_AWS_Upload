// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UMAOracleAdapter
 * @notice Adapter contract for interacting with UMA Optimistic Oracle V3
 * @dev Handles price requests, proposals, settlements, and disputes for early settlement
 */
contract UMAOracleAdapter is Ownable, ReentrancyGuard {
    // UMA Optimistic Oracle V3 interface
    IOptimisticOracleV3 public immutable optimisticOracle;
    IERC20 public immutable bondToken;
    
    // Configuration
    uint256 public defaultBond;
    uint64 public defaultLiveness;
    bytes32 public constant ASSERTION_IDENTIFIER = bytes32("YES_OR_NO_QUERY");
    
    // Request tracking
    mapping(bytes32 => address) public requestToMarket;
    mapping(address => bytes32) public marketToRequest;
    mapping(bytes32 => bool) public settledRequests;
    mapping(bytes32 => uint256) public proposalExpiryTime;
    mapping(bytes32 => bool) public proposalDisputed;
    
    // Events
    event PriceRequested(
        bytes32 indexed requestId,
        address indexed market,
        uint256 marketId,
        uint256 timestamp
    );
    event PriceProposed(
        bytes32 indexed requestId,
        address indexed proposer,
        bytes32 outcome,
        uint256 livenessEndsAt
    );
    event PriceSettled(
        bytes32 indexed requestId,
        bytes32 outcome
    );
    event ProposalDisputed(
        bytes32 indexed requestId,
        address indexed disputer,
        string reason
    );

    constructor(
        address _optimisticOracle,
        address _bondToken,
        uint256 _defaultBond,
        uint64 _defaultLiveness
    ) {
        require(_optimisticOracle != address(0), "Invalid oracle address");
        require(_bondToken != address(0), "Invalid bond token");
        require(_defaultBond > 0, "Bond must be greater than 0");
        require(_defaultLiveness > 0, "Liveness must be greater than 0");
        
        optimisticOracle = IOptimisticOracleV3(_optimisticOracle);
        bondToken = IERC20(_bondToken);
        defaultBond = _defaultBond;
        defaultLiveness = _defaultLiveness;
    }

    /**
     * @notice Request a price from UMA Optimistic Oracle
     * @param market The market contract address
     * @param marketId The market ID
     * @param timestamp The timestamp for the request
     * @return requestId The generated request ID
     */
    function requestPrice(
        address market,
        uint256 marketId,
        uint256 timestamp
    ) external nonReentrant returns (bytes32 requestId) {
        require(market != address(0), "Invalid market address");
        require(marketToRequest[market] == bytes32(0), "Request already exists");
        
        // Generate unique request ID
        requestId = keccak256(abi.encodePacked(market, marketId, timestamp, block.timestamp));
        
        // Store mapping
        requestToMarket[requestId] = market;
        marketToRequest[market] = requestId;
        
        emit PriceRequested(requestId, market, marketId, timestamp);
        
        return requestId;
    }

    /**
     * @notice Propose a price/outcome to UMA
     * @param requestId The request ID
     * @param outcome The proposed outcome (YES/NO as bytes32)
     * @param proposer The address proposing the outcome
     */
    function proposePrice(
        bytes32 requestId,
        bytes32 outcome,
        address proposer
    ) external nonReentrant {
        require(requestToMarket[requestId] != address(0), "Request does not exist");
        require(!settledRequests[requestId], "Request already settled");
        require(outcome == bytes32("YES") || outcome == bytes32("NO"), "Invalid outcome");
        
        // Transfer bond from proposer
        require(
            bondToken.transferFrom(proposer, address(this), defaultBond),
            "Bond transfer failed"
        );
        
        // Approve bond for UMA
        bondToken.approve(address(optimisticOracle), defaultBond);
        
        uint256 livenessEndsAt = block.timestamp + defaultLiveness;
        proposalExpiryTime[requestId] = livenessEndsAt;
        
        // Submit assertion to UMA
        // Note: In production, you would call the actual UMA OO V3 assertTruth function
        // For now, we emit an event to track the proposal
        
        emit PriceProposed(requestId, proposer, outcome, livenessEndsAt);
    }

    /**
     * @notice Dispute a proposal (e.g., if event hasn't occurred yet)
     * @param requestId The request ID to dispute
     * @param reason Human-readable reason for dispute
     */
    function disputeProposal(bytes32 requestId, string calldata reason) external nonReentrant {
        require(requestToMarket[requestId] != address(0), "Request does not exist");
        require(!settledRequests[requestId], "Already settled");
        require(block.timestamp < proposalExpiryTime[requestId], "Liveness period expired");
        require(!proposalDisputed[requestId], "Already disputed");
        
        // Transfer dispute bond from disputer
        require(
            bondToken.transferFrom(msg.sender, address(this), defaultBond),
            "Dispute bond transfer failed"
        );
        
        proposalDisputed[requestId] = true;
        
        // Clear pending proposal in market contract
        address market = requestToMarket[requestId];
        IMarket(market).clearPendingProposal();
        
        emit ProposalDisputed(requestId, msg.sender, reason);
        
        // In production, this would escalate to UMA's DVM for resolution
    }

    /**
     * @notice Settle a request after UMA liveness period
     * @param requestId The request ID to settle
     * @param outcome The final settled outcome
     */
    function settleRequest(bytes32 requestId, bytes32 outcome) external nonReentrant {
        require(requestToMarket[requestId] != address(0), "Request does not exist");
        require(!settledRequests[requestId], "Already settled");
        require(block.timestamp >= proposalExpiryTime[requestId], "Liveness period not expired");
        require(!proposalDisputed[requestId], "Proposal was disputed");
        
        address market = requestToMarket[requestId];
        settledRequests[requestId] = true;
        
        // Call market contract to finalize settlement
        IMarket(market).settle(outcome);
        
        emit PriceSettled(requestId, outcome);
    }

    /**
     * @notice Update default bond amount
     * @param newBond New bond amount
     */
    function setDefaultBond(uint256 newBond) external onlyOwner {
        require(newBond > 0, "Bond must be greater than 0");
        defaultBond = newBond;
    }

    /**
     * @notice Update default liveness period
     * @param newLiveness New liveness period in seconds
     */
    function setDefaultLiveness(uint64 newLiveness) external onlyOwner {
        require(newLiveness > 0, "Liveness must be greater than 0");
        defaultLiveness = newLiveness;
    }

    /**
     * @notice Get request details
     * @param requestId The request ID
     * @return market The associated market address
     * @return isSettled Whether the request is settled
     */
    function getRequestDetails(bytes32 requestId) external view returns (
        address market,
        bool isSettled
    ) {
        return (requestToMarket[requestId], settledRequests[requestId]);
    }

    /**
     * @notice Check if a proposal can be settled
     * @param requestId The request ID
     * @return canSettle Whether the proposal can be settled
     * @return timeRemaining Seconds remaining in liveness period (0 if can settle)
     */
    function canSettleProposal(bytes32 requestId) external view returns (bool canSettle, uint256 timeRemaining) {
        if (settledRequests[requestId] || proposalDisputed[requestId]) {
            return (false, 0);
        }
        
        uint256 expiryTime = proposalExpiryTime[requestId];
        if (block.timestamp >= expiryTime) {
            return (true, 0);
        } else {
            return (false, expiryTime - block.timestamp);
        }
    }
}

// UMA Optimistic Oracle V3 interface (simplified)
interface IOptimisticOracleV3 {
    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId);
}

// Market interface
interface IMarket {
    function settle(bytes32 outcome) external;
    function clearPendingProposal() external;
}
