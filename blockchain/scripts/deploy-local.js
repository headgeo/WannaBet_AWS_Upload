const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

// Mock addresses for local testing
const LOCAL_CONFIG = {
  usdc: "0x0000000000000000000000000000000000000001", // Mock USDC
  umaOracle: "0x0000000000000000000000000000000000000002", // Mock UMA Oracle
}

async function main() {
  console.log("🚀 Starting LOCAL deployment (no gas costs!)")

  const [deployer] = await hre.ethers.getSigners()
  console.log("📍 Deploying with account:", deployer.address)

  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH")

  console.log("\n📋 Local Configuration:")
  console.log("  Mock USDC:", LOCAL_CONFIG.usdc)
  console.log("  Mock UMA Oracle:", LOCAL_CONFIG.umaOracle)

  // Deploy CollateralVault
  console.log("\n📦 Deploying CollateralVault...")
  const CollateralVault = await hre.ethers.getContractFactory("CollateralVault")
  const vault = await CollateralVault.deploy(LOCAL_CONFIG.usdc)
  await vault.waitForDeployment()
  const vaultAddress = await vault.getAddress()
  console.log("✅ CollateralVault deployed to:", vaultAddress)

  // Deploy UMAOracleAdapter
  console.log("\n📦 Deploying UMAOracleAdapter...")
  const UMAOracleAdapter = await hre.ethers.getContractFactory("UMAOracleAdapter")
  const defaultBond = hre.ethers.parseUnits("1000", 6) // 1000 USDC (6 decimals)
  const defaultLiveness = 7200 // 2 hours in seconds
  const adapter = await UMAOracleAdapter.deploy(LOCAL_CONFIG.umaOracle, LOCAL_CONFIG.usdc, defaultBond, defaultLiveness)
  await adapter.waitForDeployment()
  const adapterAddress = await adapter.getAddress()
  console.log("✅ UMAOracleAdapter deployed to:", adapterAddress)

  // Deploy MarketFactory
  console.log("\n📦 Deploying MarketFactory...")
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory")
  const factory = await MarketFactory.deploy(vaultAddress, adapterAddress, LOCAL_CONFIG.usdc)
  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()
  console.log("✅ MarketFactory deployed to:", factoryAddress)

  // Save deployment addresses
  const deploymentData = {
    network: "localhost",
    chainId: 31337,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      CollateralVault: vaultAddress,
      UMAOracleAdapter: adapterAddress,
      MarketFactory: factoryAddress,
    },
    config: LOCAL_CONFIG,
  }

  const deploymentsDir = path.join(__dirname, "..", "deployments")
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const filePath = path.join(deploymentsDir, "localhost.json")
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2))

  console.log("\n✅ Deployment complete!")
  console.log("\n📄 Deployment saved to:", filePath)
  console.log("\n📋 Contract Addresses:")
  console.log("  CollateralVault:", vaultAddress)
  console.log("  UMAOracleAdapter:", adapterAddress)
  console.log("  MarketFactory:", factoryAddress)
  console.log("\n💡 Next steps:")
  console.log("  1. Test the contracts locally")
  console.log("  2. Once working, get more MATIC and deploy to Amoy")
  console.log("  3. Run: npx hardhat run scripts/deploy.js --network amoy")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
