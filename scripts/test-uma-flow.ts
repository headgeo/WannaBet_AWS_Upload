/**
 * Test script for UMA Oracle Settlement Flow
 *
 * This script tests the entire UMA settlement process locally:
 * 1. Creates a test market
 * 2. Deploys it to blockchain
 * 3. Initiates UMA settlement
 * 4. Proposes an outcome
 * 5. Finalizes settlement
 */

import { query } from "../lib/database/rds"
import { insert, select, update } from "../lib/database/adapter"
import {
  deployMarketToBlockchain,
  initiateUMASettlement,
  proposeUMAOutcome,
  finalizeUMASettlement,
} from "../app/actions/uma-settlement"
import { ethers } from "ethers"
import { closePool } from "../lib/database/rds"

async function testUMAFlow() {
  console.log("🧪 Starting UMA Oracle Settlement Test\n")

  const hasRDS = !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING)

  if (!hasRDS) {
    throw new Error(
      "Missing AWS RDS environment variables. Make sure .env.local has POSTGRES_URL or similar set up correctly.",
    )
  }

  if (!process.env.BLOCKCHAIN_NETWORK || !process.env.BLOCKCHAIN_PRIVATE_KEY) {
    throw new Error("Missing blockchain environment variables. Make sure .env.local is set up correctly.")
  }

  console.log(`📋 Configuration:`)
  console.log(`  Blockchain Network: ${process.env.BLOCKCHAIN_NETWORK}`)
  console.log(`  Database: AWS RDS\n`)

  let provider: ethers.JsonRpcProvider | null = null

  try {
    console.log("👤 Getting admin user...")
    const adminResult = await query<{ id: string }>("SELECT id FROM profiles WHERE role = 'admin' LIMIT 1")

    if (adminResult.rows.length === 0) {
      throw new Error("No admin user found. Please create an admin user first.")
    }
    const adminUserId = adminResult.rows[0].id
    console.log(`✅ Using admin user: ${adminUserId}\n`)

    // Step 1: Create a test public market
    console.log("📝 Step 1: Creating test public market...")
    const marketData = {
      title: "Test UMA Market: Will this test pass?",
      description: "Testing UMA oracle settlement flow",
      end_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      creator_id: adminUserId,
      is_private: false,
      status: "active",
      liquidity_pool: 1000,
      yes_shares: 500,
      no_shares: 500,
      qy: 0,
      qn: 0,
      b: 100,
    }

    const { data: markets, error: createError } = await insert<any>("markets", marketData)
    if (createError || !markets || markets.length === 0) {
      throw createError || new Error("Failed to create market")
    }
    const market = markets[0]
    console.log(`✅ Market created: ${market.id}\n`)

    // Step 2: Deploy market to blockchain
    console.log("🚀 Step 2: Deploying market to blockchain...")
    const deployResult = await deployMarketToBlockchain(market.id, adminUserId)
    if (!deployResult.success) throw new Error(deployResult.error)
    console.log(`✅ Market deployed to: ${deployResult.marketAddress}\n`)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Step 3: Initiate UMA settlement
    console.log("⚡ Step 3: Initiating UMA settlement...")
    const initiateResult = await initiateUMASettlement(market.id, adminUserId)
    if (!initiateResult.success) throw new Error(initiateResult.error)
    console.log(`✅ UMA settlement initiated: ${initiateResult.requestId}\n`)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    console.log("💰 Step 3.5: Approving USDC spending for UMA proposal...")
    const proposerAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" // Hardhat account #0

    // Get contract addresses from environment
    const umaAdapterAddress = process.env.LOCALHOST_UMA_ADAPTER_ADDRESS
    const mockUSDCAddress = process.env.LOCALHOST_MOCK_USDC_ADDRESS

    if (!umaAdapterAddress || !mockUSDCAddress) {
      throw new Error(
        "Missing contract addresses. Make sure LOCALHOST_UMA_ADAPTER_ADDRESS and LOCALHOST_MOCK_USDC_ADDRESS are set in .env.local",
      )
    }

    // Connect to blockchain
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545")
    const signer = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY!, provider)

    // Connect to MockUSDC contract
    const mockUSDCABI = [
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
      "function allowance(address owner, address spender) external view returns (uint256)",
    ]
    const mockUSDC = new ethers.Contract(mockUSDCAddress, mockUSDCABI, signer)

    // Check balance
    const balance = await mockUSDC.balanceOf(proposerAddress)
    console.log(`  Proposer USDC balance: ${ethers.formatUnits(balance, 6)} USDC`)

    // Approve UMAOracleAdapter to spend 10,000 USDC (more than enough for bond)
    const approvalAmount = ethers.parseUnits("10000", 6)
    const approveTx = await mockUSDC.approve(umaAdapterAddress, approvalAmount)
    await approveTx.wait()

    const allowance = await mockUSDC.allowance(proposerAddress, umaAdapterAddress)
    console.log(`✅ Approved ${ethers.formatUnits(allowance, 6)} USDC for UMAOracleAdapter\n`)

    // Step 4: Propose outcome (YES)
    console.log("🗳️  Step 4: Proposing outcome (YES)...")
    const proposeResult = await proposeUMAOutcome(market.id, true, proposerAddress, adminUserId)
    if (!proposeResult.success) throw new Error(proposeResult.error)
    console.log(`✅ Outcome proposed. Liveness ends at: ${proposeResult.livenessEndsAt}\n`)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Step 5: Fast-forward liveness period (for testing)
    console.log("⏩ Step 5: Fast-forwarding liveness period...")

    await provider.send("evm_increaseTime", [7300]) // 2 hours + 100 seconds buffer
    await provider.send("evm_mine", []) // Mine a block to apply the time change

    // Also update database timestamp
    const { error: updateError } = await update(
      "markets",
      { uma_liveness_ends_at: new Date(Date.now() - 1000).toISOString() },
      { column: "id", value: market.id },
    )

    if (updateError) throw updateError
    console.log("✅ Liveness period expired (blockchain time advanced)\n")

    // Step 6: Finalize settlement
    console.log("🏁 Step 6: Finalizing settlement...")
    const finalizeResult = await finalizeUMASettlement(market.id)
    if (!finalizeResult.success) throw new Error(finalizeResult.error)
    console.log(`✅ Market settled with outcome: ${finalizeResult.outcome ? "YES" : "NO"}\n`)

    // Step 7: Verify final state
    console.log("🔍 Step 7: Verifying final state...")
    const finalMarkets = await select<any>("markets", "*", [{ column: "id", value: market.id }])

    if (finalMarkets.length === 0) {
      throw new Error("Market not found after settlement")
    }
    const finalMarket = finalMarkets[0]

    console.log("Final Market State:")
    console.log(`  Status: ${finalMarket.status}`)
    console.log(`  Outcome: ${finalMarket.outcome}`)
    console.log(`  Blockchain Address: ${finalMarket.blockchain_market_address}`)
    console.log(`  UMA Request ID: ${finalMarket.uma_request_id}`)
    console.log(`  Blockchain Status: ${finalMarket.blockchain_status}`)

    console.log("\n✅ All tests passed! UMA settlement flow working correctly.")
  } catch (error) {
    console.error("\n❌ Test failed:", error)
    await cleanup(provider)
    process.exit(1)
  }

  await cleanup(provider)
  process.exit(0)
}

async function cleanup(provider: ethers.JsonRpcProvider | null) {
  console.log("\n🧹 Cleaning up...")

  // Close database connection pool
  try {
    await closePool()
    console.log("  ✅ Database pool closed")
  } catch (error) {
    console.error("  ⚠️  Error closing database pool:", error)
  }

  // Destroy blockchain provider
  if (provider) {
    try {
      provider.destroy()
      console.log("  ✅ Blockchain provider destroyed")
    } catch (error) {
      console.error("  ⚠️  Error destroying provider:", error)
    }
  }
}

// Run the test
testUMAFlow()
