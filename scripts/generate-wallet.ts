import { Wallet } from "ethers"

async function generateWallet() {
  console.log("\n=== Generating New Wallet for Amoy Testnet ===\n")

  // Generate random wallet
  const wallet = Wallet.createRandom()

  console.log("✅ New Wallet Generated!\n")
  console.log("Address:", wallet.address)
  console.log("Private Key:", wallet.privateKey)
  console.log("\n⚠️  IMPORTANT:")
  console.log("- Save your private key securely")
  console.log("- Add it to your .env.local as BLOCKCHAIN_PRIVATE_KEY")
  console.log("- NEVER commit this to git or share publicly")
  console.log("- This wallet will be used for deploying contracts and automated operations\n")

  console.log("Next Steps:")
  console.log("1. Copy the private key to your .env.local")
  console.log("2. Get test MATIC from: https://faucet.polygon.technology/")
  console.log("3. Paste your wallet address:", wallet.address)
  console.log('4. Select "Polygon Amoy" network')
  console.log("5. Complete CAPTCHA and receive 0.5 MATIC\n")
}

generateWallet()
