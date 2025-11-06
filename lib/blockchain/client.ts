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
    this.network = network || process.env.BLOCKCHAIN_NETWORK || "amoy"
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
   * Verify that contracts are properly deployed and accessible
   */
  async verifyContracts(): Promise<{
    marketFactory: { exists: boolean; address: string; error?: string }
    umaAdapter: { exists: boolean; address: string; error?: string }
  }> {
    const results = {
      marketFactory: { exists: false, address: "", error: undefined as string | undefined },
      umaAdapter: { exists: false, address: "", error: undefined as string | undefined },
    }

    // Check MarketFactory
    if (this.marketFactory) {
      const address = await this.marketFactory.getAddress()
      results.marketFactory.address = address

      try {
        // Check if there's bytecode at the address
        const code = await this.provider.getCode(address)
        if (code === "0x" || code === "0x0") {
          results.marketFactory.error = "No contract deployed at this address"
        } else {
          // Try calling a view function to verify the contract is accessible
          try {
            const marketCount = await this.marketFactory.marketCount()
            console.log("[UMA Client] MarketFactory verified. Market count:", marketCount.toString())
            results.marketFactory.exists = true
          } catch (error: any) {
            results.marketFactory.error = `Contract exists but function call failed: ${error.message}`
          }
        }
      } catch (error: any) {
        results.marketFactory.error = `Failed to verify contract: ${error.message}`
      }
    } else {
      results.marketFactory.error = "MarketFactory not initialized"
    }

    // Check UMAAdapter
    if (this.umaAdapter) {
      const address = await this.umaAdapter.getAddress()
      results.umaAdapter.address = address

      try {
        const code = await this.provider.getCode(address)
        if (code === "0x" || code === "0x0") {
          results.umaAdapter.error = "No contract deployed at this address"
        } else {
          results.umaAdapter.exists = true
        }
      } catch (error: any) {
        results.umaAdapter.error = `Failed to verify contract: ${error.message}`
      }
    } else {
      results.umaAdapter.error = "UMAAdapter not initialized"
    }

    return results
  }

  /**
   * Deploy a new market contract to the blockchain
   */
  async deployMarket(marketId: string, question: string, expiryTimestamp: number): Promise<MarketDeploymentResult> {
    if (!this.marketFactory) {
      throw new Error("MarketFactory contract not initialized")
    }

    console.log("[UMA Client] Verifying contracts before deployment...")
    const verification = await this.verifyContracts()
    console.log("[UMA Client] Contract verification results:", verification)

    if (!verification.marketFactory.exists) {
      throw new Error(
        `MarketFactory contract verification failed: ${verification.marketFactory.error || "Contract not accessible"}`,
      )
    }

    console.log("[UMA Client] Deploying market:", { marketId, question, expiryTimestamp })

    try {
      const tx = await this.marketFactory.createMarket(question, expiryTimestamp)

      console.log("[UMA Client] Deployment transaction sent:", tx.hash)
      const receipt = await tx.wait()

      console.log("[UMA Client] Transaction receipt details:", {
        hash: receipt.hash,
        status: receipt.status,
        gasUsed: receipt.gasUsed.toString(),
        blockNumber: receipt.blockNumber,
        logsCount: receipt.logs.length,
        contractAddress: receipt.contractAddress,
      })

      // Log all raw logs for debugging
      if (receipt.logs.length > 0) {
        console.log(
          "[UMA Client] Raw logs:",
          receipt.logs.map((log: any) => ({
            address: log.address,
            topics: log.topics,
            data: log.data,
          })),
        )
      } else {
        console.log("[UMA Client] WARNING: No logs emitted - transaction may have reverted silently")
      }

      // Extract market address and ID from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.marketFactory!.interface.parseLog(log)
          return parsed?.name === "MarketCreated"
        } catch {
          return false
        }
      })

      if (!event) {
        console.error("[UMA Client] No MarketCreated event found.")
        console.error("[UMA Client] Transaction status:", receipt.status === 1 ? "SUCCESS" : "FAILED")
        console.error("[UMA Client] This usually means the contract function reverted")
        throw new Error("MarketCreated event not found in transaction logs")
      }

      const parsed = this.marketFactory.interface.parseLog(event)
      const marketAddress = parsed?.args?.marketAddress
      const blockchainMarketId = parsed?.args?.marketId?.toString()

      console.log("[UMA Client] Market deployed successfully:", {
        marketAddress,
        blockchainMarketId,
        databaseMarketId: marketId,
      })

      return {
        marketAddress,
        transactionHash: receipt.hash,
        marketId: blockchainMarketId || marketId, // Use blockchain ID if available
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

      const nonce = await this.signer.getNonce("pending")
      console.log("[UMA Client] Using nonce:", nonce)

      const tx = await market.requestResolution({
        gasLimit: GAS_LIMITS.REQUEST_RESOLUTION,
        nonce, // Explicitly set nonce
      })

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

      if (this.network !== "localhost") {
        // Check if proposer has approved USDC spending
        if (this.usdc) {
          const allowance = await this.usdc.allowance(proposerAddress, marketAddress)
          const bondAmount = ethers.parseUnits("1000", 6) // 1000 USDC

          if (allowance < bondAmount) {
            throw new Error("Insufficient USDC allowance. User must approve USDC spending first.")
          }
        }
      } else {
        console.log("[UMA Client] Skipping USDC allowance check for localhost network")
      }

      const outcomeBytes32 = ethers.encodeBytes32String(outcome ? "YES" : "NO")
      console.log("[UMA Client] Outcome as bytes32:", outcomeBytes32)

      const nonce = await this.signer.getNonce("pending")
      console.log("[UMA Client] Using nonce:", nonce)

      const tx = await market.proposeOutcome(outcomeBytes32, {
        gasLimit: GAS_LIMITS.PROPOSE_OUTCOME,
        nonce,
      })

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

      const nonce = await this.signer.getNonce("pending")
      console.log("[UMA Client] Using nonce:", nonce)

      const tx = await this.umaAdapter.settleRequest(requestId, outcomeBytes, {
        gasLimit: GAS_LIMITS.SETTLE_MARKET,
        nonce, // Explicitly set nonce
      })

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

      const [umaRequestId, proposalCount, isSettled] = await Promise.all([
        market.umaRequestId(), // Changed from market.requestId()
        market.proposalCount(),
        market.isSettled(),
      ])

      const hasResolutionRequest = umaRequestId !== ethers.ZeroHash

      let canSettle = false
      let timeRemaining = 0

      if (hasResolutionRequest && !isSettled && this.umaAdapter) {
        const [canSettleResult, timeRemainingResult] = await this.umaAdapter.canSettleProposal(umaRequestId)
        canSettle = canSettleResult
        timeRemaining = Number(timeRemainingResult)
      }

      return {
        isDeployed: true,
        hasResolutionRequest,
        requestId: hasResolutionRequest ? umaRequestId : null,
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
    if (this.network === "localhost") {
      console.log("[UMA Client] Skipping USDC check for localhost network")
      return {
        balance: "1000000", // Mock balance for testing
        allowance: "1000000", // Mock allowance for testing
        hasEnough: true,
      }
    }

    if (!this.usdc) {
      throw new Error("USDC contract not initialized")
    }

    const bondAmount = ethers.parseUnits("1000", 6) // 1000 USDC

    try {
      const [balance, allowance] = await Promise.all([
        this.usdc.balanceOf(userAddress),
        this.usdc.allowance(userAddress, spenderAddress),
      ])

      return {
        balance: ethers.formatUnits(balance, 6),
        allowance: ethers.formatUnits(allowance, 6),
        hasEnough: balance >= bondAmount && allowance >= bondAmount,
      }
    } catch (error: any) {
      console.error("[UMA Client] USDC check failed:", error)
      return {
        balance: "0",
        allowance: "0",
        hasEnough: false,
      }
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

export function resetUMAClient(): void {
  clientInstance = null
  console.log("[UMA Client] Singleton instance reset")
}
