/**
 * UMA Blockchain Client
 * Ethers.js wrapper for interacting with UMA oracle contracts
 * Handles all blockchain operations for UMA settlement
 */

import { ethers } from "ethers"
import { getNetworkConfig, getContractAddresses, UMA_CONSTANTS, GAS_LIMITS } from "./config"
import MarketFactoryABI from "./abis/MarketFactory.json"
import MarketABI from "./abis/Market.json"
import UMAAdapterABI from "./abis/UMAOracleAdapter.json"
import ERC20ABI from "./abis/ERC20.json"

export interface MarketDeploymentResult {
  marketAddress: string
  transactionHash: string
  marketId: string
}

export interface ResolutionRequestResult {
  requestId: string
  transactionHash: string
}

export interface ProposalResult {
  transactionHash: string
  livenessEndsAt: number
}

export interface SettlementResult {
  outcome: boolean
  transactionHash: string
}

export interface MarketStatus {
  isDeployed: boolean
  hasResolutionRequest: boolean
  requestId: string | null
  proposalCount: number
  canSettle: boolean
  timeRemaining: number
}

export class UMABlockchainClient {
  private provider: ethers.Provider
  private signer: ethers.Signer
  private network: string
  private marketFactory: ethers.Contract | null = null
  private umaAdapter: ethers.Contract | null = null
  private usdc: ethers.Contract | null = null

  constructor(network?: string) {
    this.network = network || process.env.BLOCKCHAIN_NETWORK || "mumbai"
    const config = getNetworkConfig(this.network)

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)

    // Initialize signer (backend wallet for deploying markets)
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY
    if (!privateKey) {
      throw new Error("BLOCKCHAIN_PRIVATE_KEY environment variable not set")
    }
    this.signer = new ethers.Wallet(privateKey, this.provider)

    // Initialize contracts
    this.initializeContracts()
  }

  private initializeContracts() {
    const addresses = getContractAddresses(this.network)

    if (addresses.marketFactory) {
      this.marketFactory = new ethers.Contract(addresses.marketFactory, MarketFactoryABI, this.signer)
    }

    if (addresses.umaAdapter) {
      this.umaAdapter = new ethers.Contract(addresses.umaAdapter, UMAAdapterABI, this.signer)
    }

    if (addresses.usdc) {
      this.usdc = new ethers.Contract(addresses.usdc, ERC20ABI, this.signer)
    }
  }

  /**
   * Deploy a new market contract to the blockchain
   */
  async deployMarket(marketId: string, question: string, expiryTimestamp: number): Promise<MarketDeploymentResult> {
    if (!this.marketFactory) {
      throw new Error("MarketFactory contract not initialized")
    }

    console.log("[UMA Client] Deploying market:", { marketId, question, expiryTimestamp })

    try {
      const tx = await this.marketFactory.createMarket(marketId, question, expiryTimestamp, {
        gasLimit: GAS_LIMITS.DEPLOY_MARKET,
      })

      console.log("[UMA Client] Deployment transaction sent:", tx.hash)
      const receipt = await tx.wait()
      console.log("[UMA Client] Deployment confirmed:", receipt.hash)

      // Extract market address from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.marketFactory!.interface.parseLog(log)
          return parsed?.name === "MarketCreated"
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error("MarketCreated event not found in transaction logs")
      }

      const parsed = this.marketFactory.interface.parseLog(event)
      const marketAddress = parsed?.args?.marketAddress

      return {
        marketAddress,
        transactionHash: receipt.hash,
        marketId,
      }
    } catch (error: any) {
      console.error("[UMA Client] Market deployment failed:", error)
      throw new Error(`Failed to deploy market: ${error.message}`)
    }
  }

  /**
   * Request UMA oracle resolution for a market
   */
  async requestResolution(marketAddress: string, marketId: string): Promise<ResolutionRequestResult> {
    console.log("[UMA Client] Requesting resolution for market:", marketAddress)

    try {
      const market = new ethers.Contract(marketAddress, MarketABI, this.signer)

      const tx = await market.requestResolution({ gasLimit: GAS_LIMITS.REQUEST_RESOLUTION })

      console.log("[UMA Client] Resolution request sent:", tx.hash)
      const receipt = await tx.wait()
      console.log("[UMA Client] Resolution request confirmed:", receipt.hash)

      // Extract request ID from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = market.interface.parseLog(log)
          return parsed?.name === "ResolutionRequested"
        } catch {
          return false
        }
      })

      if (!event) {
        throw new Error("ResolutionRequested event not found")
      }

      const parsed = market.interface.parseLog(event)
      const requestId = parsed?.args?.requestId

      return {
        requestId,
        transactionHash: receipt.hash,
      }
    } catch (error: any) {
      console.error("[UMA Client] Resolution request failed:", error)
      throw new Error(`Failed to request resolution: ${error.message}`)
    }
  }

  /**
   * Propose an outcome to UMA oracle
   */
  async proposeOutcome(marketAddress: string, outcome: boolean, proposerAddress: string): Promise<ProposalResult> {
    console.log("[UMA Client] Proposing outcome:", { marketAddress, outcome, proposerAddress })

    try {
      const market = new ethers.Contract(marketAddress, MarketABI, this.signer)

      // Check if proposer has approved USDC spending
      if (this.usdc) {
        const allowance = await this.usdc.allowance(proposerAddress, marketAddress)
        const bondAmount = ethers.parseUnits("1000", 6) // 1000 USDC

        if (allowance < bondAmount) {
          throw new Error("Insufficient USDC allowance. User must approve USDC spending first.")
        }
      }

      const tx = await market.proposeOutcome(outcome, proposerAddress, { gasLimit: GAS_LIMITS.PROPOSE_OUTCOME })

      console.log("[UMA Client] Proposal transaction sent:", tx.hash)
      const receipt = await tx.wait()
      console.log("[UMA Client] Proposal confirmed:", receipt.hash)

      // Extract liveness end time from event
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = market.interface.parseLog(log)
          return parsed?.name === "OutcomeProposed"
        } catch {
          return false
        }
      })

      let livenessEndsAt = Math.floor(Date.now() / 1000) + UMA_CONSTANTS.DEFAULT_LIVENESS

      if (event) {
        const parsed = market.interface.parseLog(event)
        livenessEndsAt = Number(parsed?.args?.livenessEndsAt || livenessEndsAt)
      }

      return {
        transactionHash: receipt.hash,
        livenessEndsAt,
      }
    } catch (error: any) {
      console.error("[UMA Client] Proposal failed:", error)
      throw new Error(`Failed to propose outcome: ${error.message}`)
    }
  }

  /**
   * Settle a market after UMA liveness period
   */
  async settleMarket(requestId: string, outcome: boolean): Promise<SettlementResult> {
    if (!this.umaAdapter) {
      throw new Error("UMAAdapter contract not initialized")
    }

    console.log("[UMA Client] Settling market:", { requestId, outcome })

    try {
      const outcomeBytes = ethers.encodeBytes32String(outcome ? "YES" : "NO")

      const tx = await this.umaAdapter.settleRequest(requestId, outcomeBytes, { gasLimit: GAS_LIMITS.SETTLE_MARKET })

      console.log("[UMA Client] Settlement transaction sent:", tx.hash)
      const receipt = await tx.wait()
      console.log("[UMA Client] Settlement confirmed:", receipt.hash)

      return {
        outcome,
        transactionHash: receipt.hash,
      }
    } catch (error: any) {
      console.error("[UMA Client] Settlement failed:", error)
      throw new Error(`Failed to settle market: ${error.message}`)
    }
  }

  /**
   * Get market status from blockchain
   */
  async getMarketStatus(marketAddress: string): Promise<MarketStatus> {
    console.log("[UMA Client] Fetching market status:", marketAddress)

    try {
      const market = new ethers.Contract(marketAddress, MarketABI, this.provider)

      const [requestId, proposalCount, isSettled] = await Promise.all([
        market.requestId(),
        market.proposalCount(),
        market.isSettled(),
      ])

      const hasResolutionRequest = requestId !== ethers.ZeroHash

      let canSettle = false
      let timeRemaining = 0

      if (hasResolutionRequest && !isSettled && this.umaAdapter) {
        const [canSettleResult, timeRemainingResult] = await this.umaAdapter.canSettleProposal(requestId)
        canSettle = canSettleResult
        timeRemaining = Number(timeRemainingResult)
      }

      return {
        isDeployed: true,
        hasResolutionRequest,
        requestId: hasResolutionRequest ? requestId : null,
        proposalCount: Number(proposalCount),
        canSettle,
        timeRemaining,
      }
    } catch (error: any) {
      console.error("[UMA Client] Failed to fetch market status:", error)
      throw new Error(`Failed to get market status: ${error.message}`)
    }
  }

  /**
   * Check if user has sufficient USDC balance and allowance
   */
  async checkUSDCApproval(
    userAddress: string,
    spenderAddress: string,
  ): Promise<{ balance: string; allowance: string; hasEnough: boolean }> {
    if (!this.usdc) {
      throw new Error("USDC contract not initialized")
    }

    const bondAmount = ethers.parseUnits("1000", 6) // 1000 USDC

    const [balance, allowance] = await Promise.all([
      this.usdc.balanceOf(userAddress),
      this.usdc.allowance(userAddress, spenderAddress),
    ])

    return {
      balance: ethers.formatUnits(balance, 6),
      allowance: ethers.formatUnits(allowance, 6),
      hasEnough: balance >= bondAmount && allowance >= bondAmount,
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string) {
    return await this.provider.getTransactionReceipt(txHash)
  }

  /**
   * Get current block timestamp
   */
  async getCurrentBlockTimestamp(): Promise<number> {
    const block = await this.provider.getBlock("latest")
    return block ? block.timestamp : Math.floor(Date.now() / 1000)
  }
}

// Singleton instance
let clientInstance: UMABlockchainClient | null = null

export function getUMAClient(network?: string): UMABlockchainClient {
  if (!clientInstance) {
    clientInstance = new UMABlockchainClient(network)
  }
  return clientInstance
}
