require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config({ path: ".env.local" })

const getAccounts = () => {
  const privateKey = process.env.PRIVATE_KEY
  // Check if private key exists and is a valid 64-character hex string (32 bytes)
  if (privateKey && privateKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(privateKey)) {
    return [privateKey]
  }
  // Check if it has 0x prefix and is 66 characters (0x + 64 hex chars)
  if (privateKey && privateKey.length === 66 && privateKey.startsWith("0x") && /^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    return [privateKey]
  }
  return [] // Return empty array if no valid private key
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      accounts: getAccounts(),
      chainId: 80002,
      gasPrice: 5000000000, // 5 gwei (reduced from 30 gwei)
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: getAccounts(),
      chainId: 137,
      gasPrice: 50000000000, // 50 gwei
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY || "",
      polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
}
