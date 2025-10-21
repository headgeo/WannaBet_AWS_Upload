const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

// Network-specific addresses
const NETWORK_CONFIG = {
  polygon: {
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC on Polygon
    umaOracleV3: "0xa6147867264374F324524E30C02C331cF28aa879", // UMA OO V3 on Polygon
  },
  mumbai: {
    usdc: "0x9999f7Fea5938fD3b1E26A12c3f2fb024e194f97", // USDC on Mumbai
    umaOracleV3: "0x263351499f82C107e540B01F0Ca959843e22464a", // UMA OO V3 on Mumbai
  },
  localhost: {
    usdc: "0x0000000000000000000000000000000000000000", // Deploy mock for local
    umaOracleV3: "0x0000000000000000000000000000000000000000", // Deploy mock for local
  },
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const network = hre.network.name

  console.log("\n🚀 Starting deployment on network:", network)
  console.log("📍 Deploying with account:", deployer.address)
  console.log("💰 Account balance:", (await deployer.provider.getBalance(deployer.address)).toString())

  // Get network configuration
  const config = NETWORK_CONFIG[network]
  if (!config) {
    throw new Error(`No configuration found for network: ${network}`)
  }

  console.log("\n📋 Network Configuration:")
  console.log("  USDC Address:", config.usdc)
  console.log("  UMA Oracle V3:", config.umaOracleV3)

  const deployedAddresses = {}

  // Step 1: Deploy CollateralVault
  console.log("\n📦 Deploying CollateralVault...")
  const CollateralVault = await hre.ethers.getContractFactory("CollateralVault")
  const vault = await CollateralVault.deploy(config.usdc)
  await vault.waitForDeployment()
  const vaultAddress = await vault.getAddress()
  deployedAddresses.CollateralVault = vaultAddress
  console.log("✅ CollateralVault deployed to:", vaultAddress)

  // Step 2: Deploy UMAOracleAdapter
  console.log("\n📦 Deploying UMAOracleAdapter...")
  const UMAOracleAdapter = await hre.ethers.getContractFactory("UMAOracleAdapter")
  const adapter = await UMAOracleAdapter.deploy(
    config.umaOracleV3,
    config.usdc,
    hre.ethers.parseUnits("1000", 6), // 1000 USDC bond
    7200, // 2 hours liveness
  )
  await adapter.waitForDeployment()
  const adapterAddress = await adapter.getAddress()
  deployedAddresses.UMAOracleAdapter = adapterAddress
  console.log("✅ UMAOracleAdapter deployed to:", adapterAddress)

  // Step 3: Deploy MarketFactory
  console.log("\n📦 Deploying MarketFactory...")
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory")
  const factory = await MarketFactory.deploy(vaultAddress, adapterAddress)
  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()
  deployedAddresses.MarketFactory = factoryAddress
  console.log("✅ MarketFactory deployed to:", factoryAddress)

  // Step 4: Set MarketFactory as authorized in Vault and Adapter
  console.log("\n🔐 Setting up permissions...")

  console.log("  Setting factory as authorized in CollateralVault...")
  const setFactoryTx = await vault.setMarketFactory(factoryAddress)
  await setFactoryTx.wait()
  console.log("  ✅ Factory authorized in Vault")

  console.log("  Setting factory as authorized in UMAOracleAdapter...")
  const setFactoryAdapterTx = await adapter.setMarketFactory(factoryAddress)
  await setFactoryAdapterTx.wait()
  console.log("  ✅ Factory authorized in Adapter")

  // Save deployment addresses
  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: deployedAddresses,
    config,
  }

  const deploymentsDir = path.join(__dirname, "../deployments")
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const filename = path.join(deploymentsDir, `${network}.json`)
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2))

  console.log("\n📄 Deployment info saved to:", filename)

  // Print summary
  console.log("\n" + "=".repeat(60))
  console.log("🎉 DEPLOYMENT COMPLETE!")
  console.log("=".repeat(60))
  console.log("\n📋 Deployed Contracts:")
  console.log("  CollateralVault:", vaultAddress)
  console.log("  UMAOracleAdapter:", adapterAddress)
  console.log("  MarketFactory:", factoryAddress)
  console.log("\n💡 Next Steps:")
  console.log("  1. Verify contracts on Polygonscan:")
  console.log(`     npx hardhat verify --network ${network} ${vaultAddress} ${config.usdc}`)
  console.log(
    `     npx hardhat verify --network ${network} ${adapterAddress} ${config.umaOracleV3} ${config.usdc} 1000000000 7200`,
  )
  console.log(`     npx hardhat verify --network ${network} ${factoryAddress} ${vaultAddress} ${adapterAddress}`)
  console.log("\n  2. Update your backend with these addresses")
  console.log("  3. Test creating a market through the factory")
  console.log("\n" + "=".repeat(60))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:")
    console.error(error)
    process.exit(1)
  })
