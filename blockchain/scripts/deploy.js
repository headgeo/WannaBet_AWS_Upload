const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

// Network-specific addresses
const NETWORK_CONFIG = {
  polygon: {
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    umaOracleV3: "0xa6147867264374F324524E30C02C331cF28aa879",
  },
  amoy: {
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    umaOracleV3: "0x263351499f82C107e540B01F0Ca959843e22464a",
  },
  localhost: {
    usdc: "0x0000000000000000000000000000000000000000",
    umaOracleV3: "0x0000000000000000000000000000000000000000",
  },
}

function getPartialDeploymentPath(network) {
  const deploymentsDir = path.join(__dirname, "../deployments")
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }
  return path.join(deploymentsDir, `${network}-partial.json`)
}

function loadPartialDeployment(network) {
  const filepath = getPartialDeploymentPath(network)
  if (fs.existsSync(filepath)) {
    const data = JSON.parse(fs.readFileSync(filepath, "utf8"))
    console.log("\n📂 Found partial deployment, resuming from:", filepath)
    return data
  }
  return {}
}

function savePartialDeployment(network, addresses) {
  const filepath = getPartialDeploymentPath(network)
  fs.writeFileSync(filepath, JSON.stringify(addresses, null, 2))
  console.log("💾 Progress saved")
}

function clearPartialDeployment(network) {
  const filepath = getPartialDeploymentPath(network)
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
  }
}

async function main() {
  const signers = await hre.ethers.getSigners()

  if (signers.length === 0) {
    throw new Error(
      "❌ No accounts found! Please check your .env file:\n" +
        "   1. Make sure PRIVATE_KEY is set\n" +
        "   2. Remove '0x' prefix from private key (should be 64 hex characters)\n" +
        "   3. Ensure .env file is in the blockchain/ directory",
    )
  }

  const deployer = signers[0]
  const network = hre.network.name

  console.log("\n🚀 Starting deployment on network:", network)
  console.log("📍 Deploying with account:", deployer.address)

  const balance = await hre.ethers.provider.getBalance(deployer.address)
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "MATIC")

  if (balance === 0n) {
    throw new Error(
      `❌ Account ${deployer.address} has 0 balance!\n` +
        `   Get testnet MATIC from: https://faucet.polygon.technology/`,
    )
  }

  const config = NETWORK_CONFIG[network]
  if (!config) {
    throw new Error(`No configuration found for network: ${network}`)
  }

  console.log("\n📋 Network Configuration:")
  console.log("  USDC Address:", config.usdc)
  console.log("  UMA Oracle V3:", config.umaOracleV3)

  const deployedAddresses = loadPartialDeployment(network)

  let vaultAddress = deployedAddresses.CollateralVault
  let adapterAddress = deployedAddresses.UMAOracleAdapter
  let factoryAddress = deployedAddresses.MarketFactory

  if (!vaultAddress) {
    console.log("\n📦 Deploying CollateralVault...")
    const CollateralVault = await hre.ethers.getContractFactory("CollateralVault")
    const vault = await CollateralVault.deploy(config.usdc)
    await vault.waitForDeployment()
    vaultAddress = await vault.getAddress()
    deployedAddresses.CollateralVault = vaultAddress
    console.log("✅ CollateralVault deployed to:", vaultAddress)
    savePartialDeployment(network, deployedAddresses)
  } else {
    console.log("\n✓ CollateralVault already deployed:", vaultAddress)
  }

  if (!adapterAddress) {
    console.log("\n📦 Deploying UMAOracleAdapter...")
    const UMAOracleAdapter = await hre.ethers.getContractFactory("UMAOracleAdapter")
    const adapter = await UMAOracleAdapter.deploy(
      config.umaOracleV3,
      config.usdc,
      hre.ethers.parseUnits("1000", 6),
      7200,
    )
    await adapter.waitForDeployment()
    adapterAddress = await adapter.getAddress()
    deployedAddresses.UMAOracleAdapter = adapterAddress
    console.log("✅ UMAOracleAdapter deployed to:", adapterAddress)
    savePartialDeployment(network, deployedAddresses)
  } else {
    console.log("\n✓ UMAOracleAdapter already deployed:", adapterAddress)
  }

  if (!factoryAddress) {
    console.log("\n📦 Deploying MarketFactory...")
    const MarketFactory = await hre.ethers.getContractFactory("MarketFactory")
    const factory = await MarketFactory.deploy(vaultAddress, adapterAddress, config.usdc)
    await factory.waitForDeployment()
    factoryAddress = await factory.getAddress()
    deployedAddresses.MarketFactory = factoryAddress
    console.log("✅ MarketFactory deployed to:", factoryAddress)
    savePartialDeployment(network, deployedAddresses)
  } else {
    console.log("\n✓ MarketFactory already deployed:", factoryAddress)
  }

  if (!deployedAddresses.permissionsSet) {
    console.log("\n🔐 Setting up permissions...")

    const vault = await hre.ethers.getContractAt("CollateralVault", vaultAddress)
    const adapter = await hre.ethers.getContractAt("UMAOracleAdapter", adapterAddress)

    console.log("  Setting factory as authorized in CollateralVault...")
    const setFactoryTx = await vault.setMarketFactory(factoryAddress)
    await setFactoryTx.wait()
    console.log("  ✅ Factory authorized in Vault")

    console.log("  Setting factory as authorized in UMAOracleAdapter...")
    const setFactoryAdapterTx = await adapter.setMarketFactory(factoryAddress)
    await setFactoryAdapterTx.wait()
    console.log("  ✅ Factory authorized in Adapter")

    deployedAddresses.permissionsSet = true
    savePartialDeployment(network, deployedAddresses)
  } else {
    console.log("\n✓ Permissions already set")
  }

  const deploymentInfo = {
    network,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      CollateralVault: vaultAddress,
      UMAOracleAdapter: adapterAddress,
      MarketFactory: factoryAddress,
    },
    config,
  }

  const deploymentsDir = path.join(__dirname, "../deployments")
  const filename = path.join(deploymentsDir, `${network}.json`)
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2))
  clearPartialDeployment(network)

  console.log("\n📄 Deployment info saved to:", filename)

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
  console.log(
    `     npx hardhat verify --network ${network} ${factoryAddress} ${vaultAddress} ${adapterAddress} ${config.usdc}`,
  )
  console.log("\n  2. Update your backend .env with these addresses:")
  console.log(`     AMOY_COLLATERAL_VAULT_ADDRESS=${vaultAddress}`)
  console.log(`     AMOY_UMA_ADAPTER_ADDRESS=${adapterAddress}`)
  console.log(`     AMOY_MARKET_FACTORY_ADDRESS=${factoryAddress}`)
  console.log("\n  3. Test creating a market through the factory")
  console.log("\n" + "=".repeat(60))
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:")
    console.error(error)
    process.exit(1)
  })
