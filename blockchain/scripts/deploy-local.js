const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
  console.log("🚀 Starting LOCAL deployment (no gas costs!)")

  const [deployer] = await hre.ethers.getSigners()
  console.log("📍 Deploying with account:", deployer.address)

  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH")

  console.log("\n📦 Deploying MockERC20 (USDC)...")
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20")
  const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6)
  await mockUSDC.waitForDeployment()
  const mockUSDCAddress = await mockUSDC.getAddress()
  console.log("✅ MockERC20 (USDC) deployed to:", mockUSDCAddress)

  // Mint 1 million USDC to deployer for testing
  console.log("💰 Minting 1,000,000 USDC to deployer...")
  await mockUSDC.mint(deployer.address, hre.ethers.parseUnits("1000000", 6))
  const deployerBalance = await mockUSDC.balanceOf(deployer.address)
  console.log("✅ Deployer USDC balance:", hre.ethers.formatUnits(deployerBalance, 6), "USDC")

  const mockUMAOracle = "0x0000000000000000000000000000000000000002"

  console.log("\n📋 Local Configuration:")
  console.log("  Mock USDC:", mockUSDCAddress)
  console.log("  Mock UMA Oracle:", mockUMAOracle)

  // Deploy CollateralVault
  console.log("\n📦 Deploying CollateralVault...")
  const CollateralVault = await hre.ethers.getContractFactory("CollateralVault")
  const vault = await CollateralVault.deploy(mockUSDCAddress)
  await vault.waitForDeployment()
  const vaultAddress = await vault.getAddress()
  console.log("✅ CollateralVault deployed to:", vaultAddress)

  // Deploy UMAOracleAdapter
  console.log("\n📦 Deploying UMAOracleAdapter...")
  const UMAOracleAdapter = await hre.ethers.getContractFactory("UMAOracleAdapter")
  const defaultBond = hre.ethers.parseUnits("1000", 6) // 1000 USDC (6 decimals)
  const defaultLiveness = 7200 // 2 hours in seconds
  const adapter = await UMAOracleAdapter.deploy(mockUMAOracle, mockUSDCAddress, defaultBond, defaultLiveness)
  await adapter.waitForDeployment()
  const adapterAddress = await adapter.getAddress()
  console.log("✅ UMAOracleAdapter deployed to:", adapterAddress)

  // Deploy MarketFactory
  console.log("\n📦 Deploying MarketFactory...")
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory")
  const factory = await MarketFactory.deploy(vaultAddress, adapterAddress, mockUSDCAddress)
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
      MockUSDC: mockUSDCAddress,
      CollateralVault: vaultAddress,
      UMAOracleAdapter: adapterAddress,
      MarketFactory: factoryAddress,
    },
    config: {
      usdc: mockUSDCAddress,
      umaOracle: mockUMAOracle,
    },
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
  console.log("  MockUSDC:", mockUSDCAddress)
  console.log("  CollateralVault:", vaultAddress)
  console.log("  UMAOracleAdapter:", adapterAddress)
  console.log("  MarketFactory:", factoryAddress)
  console.log("\n💡 Next steps:")
  console.log("  1. Update your .env.local with these addresses")
  console.log("  2. Test the UMA flow with: npm run test:uma")
  console.log("  3. Once working, deploy to Polygon Amoy testnet")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
