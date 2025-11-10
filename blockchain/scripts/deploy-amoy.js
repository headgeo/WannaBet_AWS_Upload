const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

async function main() {
  console.log("🚀 Starting AMOY TESTNET deployment")
  console.log("⚠️  This will use real testnet MATIC (but no cost for wrong deploys!)")

  const [deployer] = await hre.ethers.getSigners()
  console.log("📍 Deploying with account:", deployer.address)

  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MATIC")

  if (balance < hre.ethers.parseEther("0.5")) {
    console.warn("⚠️  Warning: Low balance! Get test MATIC from https://faucet.polygon.technology/")
  }

  // UMA OptimisticOracleV3 on Polygon Amoy
  // Source: https://github.com/UMAprotocol/protocol/blob/master/packages/core/networks/80002.json
  const umaOracleAddress = "0x263351499f82C107e540B01F0Ca959843e22464a"

  console.log("\n📋 Using UMA Oracle on Amoy:")
  console.log("  UMA OptimisticOracleV3:", umaOracleAddress)

  // Step 1: Deploy MockERC20 (USDC) for testnet
  console.log("\n📦 Step 1/4: Deploying MockERC20 (Test USDC)...")
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20")
  const mockUSDC = await MockERC20.deploy("Mock USDC", "USDC", 6)
  await mockUSDC.waitForDeployment()
  const mockUSDCAddress = await mockUSDC.getAddress()
  console.log("✅ MockERC20 (USDC) deployed to:", mockUSDCAddress)

  // Mint initial supply to deployer
  console.log("💰 Minting 10,000,000 USDC to deployer for testing...")
  const mintTx = await mockUSDC.mint(deployer.address, hre.ethers.parseUnits("10000000", 6))
  await mintTx.wait()
  const deployerBalance = await mockUSDC.balanceOf(deployer.address)
  console.log("✅ Deployer USDC balance:", hre.ethers.formatUnits(deployerBalance, 6), "USDC")

  // Step 2: Deploy CollateralVault
  console.log("\n📦 Step 2/4: Deploying CollateralVault...")
  const CollateralVault = await hre.ethers.getContractFactory("CollateralVault")
  const vault = await CollateralVault.deploy(mockUSDCAddress)
  await vault.waitForDeployment()
  const vaultAddress = await vault.getAddress()
  console.log("✅ CollateralVault deployed to:", vaultAddress)

  // Step 3: Deploy UMAOracleAdapter
  console.log("\n📦 Step 3/4: Deploying UMAOracleAdapter...")
  const UMAOracleAdapter = await hre.ethers.getContractFactory("UMAOracleAdapter")
  const defaultBond = hre.ethers.parseUnits("1000", 6) // 1000 USDC (6 decimals)
  const defaultLiveness = 7200 // 2 hours in seconds
  const adapter = await UMAOracleAdapter.deploy(umaOracleAddress, mockUSDCAddress, defaultBond, defaultLiveness)
  await adapter.waitForDeployment()
  const adapterAddress = await adapter.getAddress()
  console.log("✅ UMAOracleAdapter deployed to:", adapterAddress)
  console.log("   Bond Amount:", hre.ethers.formatUnits(defaultBond, 6), "USDC")
  console.log("   Liveness Period:", defaultLiveness / 3600, "hours")

  // Step 4: Deploy MarketFactory
  console.log("\n📦 Step 4/4: Deploying MarketFactory...")
  const MarketFactory = await hre.ethers.getContractFactory("MarketFactory")
  const factory = await MarketFactory.deploy(vaultAddress, adapterAddress, mockUSDCAddress)
  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()
  console.log("✅ MarketFactory deployed to:", factoryAddress)

  // Verify initial state
  const marketCount = await factory.marketCount()
  console.log("✅ Market count initialized:", marketCount.toString())

  // Save deployment addresses
  const deploymentData = {
    network: "amoy",
    chainId: 80002,
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
      umaOracle: umaOracleAddress,
      bondAmount: hre.ethers.formatUnits(defaultBond, 6),
      livenessPeriod: defaultLiveness,
    },
    urls: {
      blockExplorer: "https://amoy.polygonscan.com",
      mockUSDC: `https://amoy.polygonscan.com/address/${mockUSDCAddress}`,
      vault: `https://amoy.polygonscan.com/address/${vaultAddress}`,
      adapter: `https://amoy.polygonscan.com/address/${adapterAddress}`,
      factory: `https://amoy.polygonscan.com/address/${factoryAddress}`,
    },
  }

  const deploymentsDir = path.join(__dirname, "..", "deployments")
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const filePath = path.join(deploymentsDir, "amoy.json")
  fs.writeFileSync(filePath, JSON.stringify(deploymentData, null, 2))

  console.log("\n✅ Deployment complete!")
  console.log("\n📄 Deployment saved to:", filePath)
  console.log("\n📋 Contract Addresses:")
  console.log("  MockUSDC:", mockUSDCAddress)
  console.log("  CollateralVault:", vaultAddress)
  console.log("  UMAOracleAdapter:", adapterAddress)
  console.log("  MarketFactory:", factoryAddress)

  console.log("\n🔍 View on PolygonScan:")
  console.log("  MockUSDC:", `https://amoy.polygonscan.com/address/${mockUSDCAddress}`)
  console.log("  CollateralVault:", `https://amoy.polygonscan.com/address/${vaultAddress}`)
  console.log("  UMAOracleAdapter:", `https://amoy.polygonscan.com/address/${adapterAddress}`)
  console.log("  MarketFactory:", `https://amoy.polygonscan.com/address/${factoryAddress}`)

  console.log("\n💡 Next steps:")
  console.log("  1. Add these to your .env.local:")
  console.log(`     AMOY_COLLATERAL_VAULT_ADDRESS=${vaultAddress}`)
  console.log(`     AMOY_UMA_ADAPTER_ADDRESS=${adapterAddress}`)
  console.log(`     AMOY_MARKET_FACTORY_ADDRESS=${factoryAddress}`)
  console.log(`     AMOY_MOCK_USDC_ADDRESS=${mockUSDCAddress}`)
  console.log("  2. Verify contracts on PolygonScan (optional):")
  console.log("     npx hardhat verify --network amoy <address> <constructor-args>")
  console.log("  3. Test market creation on Amoy testnet")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
