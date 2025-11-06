const fs = require("fs")
const path = require("path")

async function exportABIs() {
  console.log("📦 Exporting contract ABIs...")

  const artifactsDir = path.join(__dirname, "../artifacts/contracts")
  const outputDir = path.join(__dirname, "../../lib/blockchain/abis")

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const contracts = [
    { name: "MarketFactory", path: "MarketFactory.sol/MarketFactory.json" },
    { name: "Market", path: "Market.sol/Market.json" },
    { name: "UMAOracleAdapter", path: "UMAOracleAdapter.sol/UMAOracleAdapter.json" },
    { name: "CollateralVault", path: "CollateralVault.sol/CollateralVault.json" },
  ]

  for (const contract of contracts) {
    try {
      const artifactPath = path.join(artifactsDir, contract.path)
      const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"))

      const outputPath = path.join(outputDir, `${contract.name}.json`)
      fs.writeFileSync(outputPath, JSON.stringify(artifact.abi, null, 2))

      console.log(`✅ Exported ${contract.name} ABI`)
    } catch (error) {
      console.error(`❌ Failed to export ${contract.name}:`, error.message)
    }
  }

  // Also export ERC20 ABI for USDC interactions
  const erc20ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)",
  ]

  fs.writeFileSync(path.join(outputDir, "ERC20.json"), JSON.stringify(erc20ABI, null, 2))
  console.log("✅ Exported ERC20 ABI")

  console.log("\n✨ All ABIs exported successfully!")
}

exportABIs().catch(console.error)
