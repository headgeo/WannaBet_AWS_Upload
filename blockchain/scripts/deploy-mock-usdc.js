const hre = require("hardhat")

async function main() {
  console.log("Deploying Mock USDC to Amoy testnet...")

  const [deployer] = await hre.ethers.getSigners()
  console.log("Deploying with account:", deployer.address)

  // Deploy MockERC20 as USDC
  const MockERC20 = await hre.ethers.getContractFactory("MockERC20")
  const mockUSDC = await MockERC20.deploy(
    "USD Coin (Test)",
    "USDC",
    6, // USDC has 6 decimals
  )

  await mockUSDC.waitForDeployment()
  const address = await mockUSDC.getAddress()

  console.log("Mock USDC deployed to:", address)

  // Mint 10,000 USDC to deployer for testing
  const mintAmount = hre.ethers.parseUnits("10000", 6)
  await mockUSDC.mint(deployer.address, mintAmount)
  console.log("Minted 10,000 USDC to:", deployer.address)

  // Save deployment info
  const fs = require("fs")
  const deploymentInfo = {
    network: hre.network.name,
    mockUSDC: address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(`deployments/${hre.network.name}-mock-usdc.json`, JSON.stringify(deploymentInfo, null, 2))

  console.log("\n✅ Mock USDC deployment complete!")
  console.log("Add this to your .env file:")
  console.log(`USDC_ADDRESS_AMOY=${address}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
