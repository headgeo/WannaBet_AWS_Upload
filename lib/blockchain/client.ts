/**
 * UMA Blockchain Client
 * Ethers.js wrapper for interacting with UMA oracle contracts
 * Handles all blockchain operations for UMA settlement
 */

import { ethers } from "ethers"
import { getNetworkConfig, getContractAddresses, UMA_CONSTANTS, GAS_LIMITS } from "./config"
import OptimisticOracleV3ABI from "./abis/OptimisticOracleV3.json"
import ERC20ABI from "./abis/ERC20.json"

export interface MarketDeploymentResult {
  marketAddress: string
  transactionHash: string
  marketId: string
  assertionId?: string
}

export interface ResolutionRequestResult {
  requestId: string
  transactionHash: string
}

export interface ProposalResult {
  assertionId: string
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
  hasAssertion: boolean
  isSettled: boolean
}

export class UMABlockchainClient {
  private provider: ethers.Provider
  private signer: ethers.Signer
  private network: string
  private optimisticOracle: ethers.Contract | null = null
  private usdc: ethers.Contract | null = null

  constructor(network?: string) {
    this.network = network || process.env.BLOCKCHAIN_NETWORK || "amoy"
    const config = getNetworkConfig(this.network)

    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)

    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY
    if (!privateKey) {
      throw new Error("BLOCKCHAIN_PRIVATE_KEY environment variable not set")
    }
    this.signer = new ethers.Wallet(privateKey, this.provider)

    this.initializeContracts()
  }

  private initializeContracts() {
    const addresses = getContractAddresses(this.network)

    if (addresses.umaOracle) {
      this.optimisticOracle = new ethers.Contract(addresses.umaOracle, OptimisticOracleV3ABI, this.signer)
    } else {
      throw new Error(`OptimisticOracleV3 address not configured for network: ${this.network}`)
    }

    if (addresses.usdc) {
      this.usdc = new ethers.Contract(addresses.usdc, ERC20ABI, this.signer)
    } else {
      throw new Error(`USDC address not configured for network: ${this.network}`)
    }
  }

  /**
   * Verify that contracts are properly deployed and accessible
   */
  async verifyContracts(): Promise<{
    optimisticOracle: { exists: boolean; address: string; error?: string }
    usdc: { exists: boolean; address: string; error?: string }
  }> {
    const results = {
      optimisticOracle: { exists: false, address: "", error: undefined as string | undefined },
      usdc: { exists: false, address: "", error: undefined as string | undefined },
    }

    if (this.optimisticOracle) {
      const address = await this.optimisticOracle.getAddress()
      results.optimisticOracle.address = address

      try {
        const code = await this.provider.getCode(address)
        if (code === "0x" || code === "0x0") {
          results.optimisticOracle.error = "No contract deployed at this address"
        } else {
          results.optimisticOracle.exists = true
        }
      } catch (error: any) {
        results.optimisticOracle.error = `Failed to verify contract: ${error.message}`
      }
    } else {
      results.optimisticOracle.error = "OptimisticOracle not initialized"
    }

    if (this.usdc) {
      const address = await this.usdc.getAddress()
      results.usdc.address = address

      try {
        const code = await this.provider.getCode(address)
        if (code === "0x" || code === "0x0") {
          results.usdc.error = "No contract deployed at this address"
        } else {
          results.usdc.exists = true
        }
      } catch (error: any) {
        results.usdc.error = `Failed to verify contract: ${error.message}`
      }
    } else {
      results.usdc.error = "USDC contract not initialized"
    }

    return results
  }

  /**
   * Prepare a market for UMA settlement by approving the reward amount
   * Returns the approval transaction hash as the "deployment" transaction
   */
  async deployMarket(
    marketId: string,
    question: string,
    expiryTimestamp: number,
    rewardAmount = "10", // $10 USD
  ): Promise<MarketDeploymentResult> {
    if (!this.usdc || !this.optimisticOracle) {
      throw new Error("Contracts not initialized")
    }

    try {
      const signerAddress = await this.signer.getAddress()

      const rewardWei = ethers.parseUnits(rewardAmount, 6)
      const balance = await this.usdc.balanceOf(signerAddress)

      if (balance < rewardWei) {
        throw new Error(
          `Insufficient USDC in platform wallet. Need ${rewardAmount} USDC, have ${ethers.formatUnits(balance, 6)} USDC`,
        )
      }

      const oracleAddress = await this.optimisticOracle.getAddress()

      const currentAllowance = await this.usdc.allowance(signerAddress, oracleAddress)

      let transactionHash: string

      if (currentAllowance < rewardWei) {
        const approveTx = await this.usdc.approve(oracleAddress, rewardWei, {
          gasLimit: GAS_LIMITS.USDC_APPROVAL,
        })
        const receipt = await approveTx.wait()
        transactionHash = receipt!.hash
      } else {
        transactionHash = "0x" + "1".repeat(64)
      }

      const marketAddressHash = ethers.keccak256(ethers.toUtf8Bytes(marketId))
      const pseudoAddress = "0x" + marketAddressHash.slice(26)

      return {
        marketAddress: pseudoAddress,
        transactionHash,
        marketId,
      }
    } catch (error: any) {
      console.error("[Blockchain] Market deployment failed:", error.message)
      throw new Error(`Deployment failed: ${error.message}`)
    }
  }

  /**
   * Propose an outcome using UMA's assertTruth function
   * This is where the real blockchain interaction happens
   */
  async proposeOutcome(
    marketId: string,
    question: string,
    outcome: boolean,
    expiryTimestamp: number,
  ): Promise<ProposalResult> {
    if (!this.optimisticOracle || !this.usdc) {
      throw new Error("Contracts not initialized")
    }

    try {
      const signerAddress = await this.signer.getAddress()
      const bondAmount = ethers.parseUnits("500", 6) // $500 bond

      const balance = await this.usdc.balanceOf(signerAddress)

      if (balance < bondAmount) {
        throw new Error(`Insufficient USDC. Need 500 USDC to propose, have ${ethers.formatUnits(balance, 6)} USDC`)
      }

      const oracleAddress = await this.optimisticOracle.getAddress()
      const allowance = await this.usdc.allowance(signerAddress, oracleAddress)

      if (allowance < bondAmount) {
        const approveTx = await this.usdc.approve(oracleAddress, bondAmount, {
          gasLimit: GAS_LIMITS.USDC_APPROVAL,
        })
        await approveTx.wait()
      }

      const outcomeText = outcome ? "YES" : "NO"
      const claim = `The outcome of market "${question}" (ID: ${marketId}) is ${outcomeText}.`
      const claimBytes = ethers.toUtf8Bytes(claim)

      const currentTime = Math.floor(Date.now() / 1000)
      const liveness = UMA_CONSTANTS.DEFAULT_LIVENESS // 2 hours in seconds

      const usdcAddress = await this.usdc.getAddress()

      const tx = await this.optimisticOracle.assertTruth(
        claimBytes,
        signerAddress, // asserter
        ethers.ZeroAddress, // callbackRecipient (none)
        ethers.ZeroAddress, // escalationManager (none)
        liveness,
        usdcAddress, // currency
        bondAmount, // bond
        ethers.id("ASSERT_TRUTH"), // identifier
        ethers.ZeroHash, // domain (not used)
        {
          gasLimit: GAS_LIMITS.DEPLOY_MARKET,
        },
      )

      const receipt = await tx.wait()

      const assertionEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.optimisticOracle!.interface.parseLog(log)
          return parsed?.name === "AssertionMade"
        } catch {
          return false
        }
      })

      let assertionId = ethers.ZeroHash
      if (assertionEvent) {
        const parsed = this.optimisticOracle.interface.parseLog(assertionEvent)
        assertionId = parsed?.args.assertionId || ethers.ZeroHash
      }

      const livenessEndsAt = currentTime + liveness

      return {
        assertionId,
        transactionHash: receipt.hash,
        livenessEndsAt,
      }
    } catch (error: any) {
      console.error("[Blockchain] Proposal failed:", error.message)
      throw error
    }
  }

  /**
   * Settle assertion after challenge period
   */
  async settleAssertion(assertionId: string): Promise<SettlementResult> {
    if (!this.optimisticOracle) {
      throw new Error("OptimisticOracle not initialized")
    }

    try {
      const tx = await this.optimisticOracle.settleAssertion(assertionId, {
        gasLimit: GAS_LIMITS.SETTLE_MARKET,
      })

      const receipt = await tx.wait()

      const assertion = await this.optimisticOracle.getAssertion(assertionId)
      const outcome = !assertion.settlementResolution // true if assertion was correct

      return {
        outcome,
        transactionHash: receipt.hash,
      }
    } catch (error: any) {
      console.error("[Blockchain] Settlement failed:", error.message)
      throw error
    }
  }

  /**
   * Get assertion status
   */
  async getAssertionStatus(assertionId: string): Promise<MarketStatus> {
    if (!this.optimisticOracle) {
      throw new Error("OptimisticOracle not initialized")
    }

    try {
      const assertion = await this.optimisticOracle.getAssertion(assertionId)

      const currentTime = Math.floor(Date.now() / 1000)
      const expirationTime = Number(assertion.expirationTime)
      const timeRemaining = Math.max(0, expirationTime - currentTime)
      const canSettle = assertion.settled === false && timeRemaining === 0

      return {
        isDeployed: true,
        hasResolutionRequest: false, // No longer relevant in this version
        requestId: null, // No longer relevant in this version
        proposalCount: 0, // No longer relevant in this version
        canSettle,
        timeRemaining,
        hasAssertion: true,
        isSettled: assertion.settled,
      }
    } catch (error: any) {
      console.error("[Blockchain] Get assertion status failed:", error.message)
      return {
        isDeployed: false,
        hasResolutionRequest: false,
        requestId: null,
        proposalCount: 0,
        canSettle: false,
        timeRemaining: 0,
        hasAssertion: false,
        isSettled: false,
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

let clientInstance: UMABlockchainClient | null = null

export function getUMAClient(network?: string): UMABlockchainClient {
  if (!clientInstance) {
    clientInstance = new UMABlockchainClient(network)
  }
  return clientInstance
}

export function resetUMAClient(): void {
  clientInstance = null
}
