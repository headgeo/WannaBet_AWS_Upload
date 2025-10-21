const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
  const network = hre.network.name

  console.log("\n🔍 Verifying contracts on network:", network)

  // Load deployment info
  const filename = path.join(__dirname, "../deployments", `${network}.json`)
  if (!fs.existsSync(filename)) {
    throw new Error(`No deployment found for network: ${network}`)
  }

  const deployment = JSON.parse(fs.readFileSync(filename, "utf8"))
  const { contracts, config } = deployment

  console.log("\n📋 Loaded deployment info:")
  console.log("  CollateralVault:", contracts.CollateralVault)
  console.log("  UMAOracleAdapter:", contracts.UMAOracleAdapter)
  console.log("  MarketFactory:", contracts.MarketFactory)

  // Verify CollateralVault
  console.log("\n🔍 Verifying CollateralVault...")
  try {
    await hre.run("verify:verify", {
      address: contracts.CollateralVault,
      constructorArguments: [config.usdc],
    })
    console.log("✅ CollateralVault verified")
  } catch (error) {
    console.log("⚠️  CollateralVault verification failed:", error.message)
  }

  // Verify UMAOracleAdapter
  console.log("\n🔍 Verifying UMAOracleAdapter...")
  try {
    await hre.run("verify:verify", {
      address: contracts.UMAOracleAdapter,
      constructorArguments: [
        config.umaOracleV3,
        config.usdc,
        hre.ethers.parseUnits("1000", 6), // 1000 USDC bond
        7200, // 2 hours liveness
      ],
    })
    console.log("✅ UMAOracleAdapter verified")
  } catch (error) {
    console.log("⚠️  UMAOracleAdapter verification failed:", error.message)
  }

  // Verify MarketFactory
  console.log("\n🔍 Verifying MarketFactory...")
  try {
    await hre.run("verify:verify", {
      address: contracts.MarketFactory,
      constructorArguments: [contracts.CollateralVault, contracts.UMAOracleAdapter],
    })
    console.log("✅ MarketFactory verified")
  } catch (error) {
    console.log("⚠️  MarketFactory verification failed:", error.message)
  }

  console.log("\n✅ Verification complete!")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Verification failed:")
    console.error(error)
    process.exit(1)
  })
