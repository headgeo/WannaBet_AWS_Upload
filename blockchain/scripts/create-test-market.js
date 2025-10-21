const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const network = hre.network.name

  console.log("\n🧪 Creating test market on network:", network)
  console.log("📍 Using account:", deployer.address)

  // Load deployment info
  const filename = path.join(__dirname, "../deployments", `${network}.json`)
  if (!fs.existsSync(filename)) {
    throw new Error(`No deployment found for network: ${network}`)
  }

  const deployment = JSON.parse(fs.readFileSync(filename, "utf8"))
  const factoryAddress = deployment.contracts.MarketFactory

  console.log("📍 MarketFactory address:", factoryAddress)

  // Get factory contract
  const factory = await hre.ethers.getContractAt("MarketFactory", factoryAddress)

  // Create test market
  const question = "Will ETH reach $5000 by end of 2025?"
  const expiryDate = Math.floor(Date.now() / 1000) + 86400 * 30 // 30 days from now
  const category = "Crypto"

  console.log("\n📝 Creating market:")
  console.log("  Question:", question)
  console.log("  Expiry:", new Date(expiryDate * 1000).toISOString())
  console.log("  Category:", category)

  const tx = await factory.createMarket(question, expiryDate, category)
  console.log("\n⏳ Transaction sent:", tx.hash)
  console.log("   Waiting for confirmation...")

  const receipt = await tx.wait()
  console.log("✅ Transaction confirmed!")

  // Find MarketCreated event
  const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "MarketCreated")

  if (event) {
    const marketId = event.args.marketId
    const marketAddress = event.args.marketAddress

    console.log("\n🎉 Market created successfully!")
    console.log("  Market ID:", marketId.toString())
    console.log("  Market Address:", marketAddress)
    console.log("\n💡 You can now:")
    console.log("  1. View this market in your frontend")
    console.log("  2. Place trades on this market")
    console.log("  3. After expiry, propose outcomes via UMA")
  } else {
    console.log("\n⚠️  Market created but couldn't find event details")
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Failed to create test market:")
    console.error(error)
    process.exit(1)
  })
