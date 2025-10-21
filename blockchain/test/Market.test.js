const { expect } = require("chai")
const { ethers } = require("hardhat")
const { time } = require("@nomicfoundation/hardhat-network-helpers")

describe("Market Contract", () => {
  let market, vault, adapter, usdc
  let owner, user1, user2
  const marketQuestion = "Will ETH reach $5000 by end of 2024?"
  let expiryTime
  const bondAmount = ethers.parseUnits("100", 6)

  beforeEach(async () => {
    ;[owner, user1, user2] = await ethers.getSigners()

    const MockERC20 = await ethers.getContractFactory("MockERC20")
    usdc = await MockERC20.deploy("Mock USDC", "USDC", 6)
    await usdc.waitForDeployment()

    const CollateralVault = await ethers.getContractFactory("CollateralVault")
    vault = await CollateralVault.deploy(await usdc.getAddress())
    await vault.waitForDeployment()

    const UMAOracleAdapter = await ethers.getContractFactory("UMAOracleAdapter")
    adapter = await UMAOracleAdapter.deploy(user2.address, await usdc.getAddress(), bondAmount, 7200)
    await adapter.waitForDeployment()

    expiryTime = (await time.latest()) + 86400
    const Market = await ethers.getContractFactory("Market")
    market = await Market.deploy(
      1,
      marketQuestion,
      expiryTime,
      await usdc.getAddress(),
      await adapter.getAddress(),
      await vault.getAddress(),
    )
    await market.waitForDeployment()

    await usdc.mint(user1.address, ethers.parseUnits("1000", 6))
    await usdc.mint(user2.address, ethers.parseUnits("1000", 6))
    await usdc.mint(owner.address, ethers.parseUnits("1000", 6))
  })

  async function approveUSDCForProposal(user) {
    await usdc.connect(user).approve(await adapter.getAddress(), bondAmount)
  }

  describe("Market Creation", () => {
    it("Should create market with correct parameters", async () => {
      expect(await market.marketId()).to.equal(1)
      expect(await market.question()).to.equal(marketQuestion)
      expect(await market.expiryTimestamp()).to.equal(expiryTime)
      expect(await market.isSettled()).to.equal(false)
    })

    it("Should have correct initial proposal count", async () => {
      expect(await market.proposalCount()).to.equal(0)
    })
  })

  describe("Early Settlement (Proposals Before Expiry)", () => {
    it("Should allow proposals BEFORE expiry", async () => {
      const currentTime = await time.latest()
      expect(currentTime).to.be.lessThan(expiryTime)

      await market.requestResolution()
      await approveUSDCForProposal(user1)

      await expect(market.connect(user1).proposeOutcome(ethers.encodeBytes32String("YES"))).to.not.be.revertedWith(
        "Market not expired yet",
      )
    })

    it("Should allow disputes during liveness period", async () => {
      await market.requestResolution()

      await approveUSDCForProposal(user1)

      // Make a proposal
      await market.connect(user1).proposeOutcome(ethers.encodeBytes32String("YES"))

      // Dispute should be allowed
      const disputeAttempt = market.connect(user2).disputeProposal()
      await expect(disputeAttempt).to.not.be.revertedWith("No pending proposal")
    })

    it("Should clear pending proposal after dispute", async () => {
      await market.requestResolution()

      await approveUSDCForProposal(user1)

      // Make a proposal
      await market.connect(user1).proposeOutcome(ethers.encodeBytes32String("YES"))

      // Dispute it
      await market.connect(user2).disputeProposal()

      await approveUSDCForProposal(user1)

      // Should be able to make another proposal now
      const newProposal = market.connect(user1).proposeOutcome(ethers.encodeBytes32String("NO"))
      await expect(newProposal).to.not.be.revertedWith("Proposal already pending")
    })
  })

  describe("Proposal Restrictions", () => {
    it("Should enforce max 2 proposals", async () => {
      expect(await market.MAX_PROPOSALS()).to.equal(2)
    })

    it("Should block proposals after max count reached", async () => {
      await market.requestResolution()

      await approveUSDCForProposal(user1)
      await market.connect(user1).proposeOutcome(ethers.encodeBytes32String("YES"))

      await approveUSDCForProposal(user2)
      await market.connect(user2).proposeOutcome(ethers.encodeBytes32String("NO"))

      await approveUSDCForProposal(owner)
      await expect(market.connect(owner).proposeOutcome(ethers.encodeBytes32String("YES"))).to.be.revertedWith(
        "Max proposals reached",
      )
    })
  })

  describe("Market Resolution", () => {
    it("Should allow resolution request at any time", async () => {
      await expect(market.requestResolution()).to.not.be.revertedWith("Market not expired yet")
    })

    it("Should allow proposals after expiry (backward compatibility)", async () => {
      await time.increaseTo(expiryTime + 1)
      await market.requestResolution()
      await approveUSDCForProposal(user1)

      await expect(market.connect(user1).proposeOutcome(ethers.encodeBytes32String("YES"))).to.not.be.revertedWith(
        "Market not expired yet",
      )
    })
  })

  describe("Settlement", () => {
    it("Should only allow UMA adapter to settle", async () => {
      await market.requestResolution()

      const outcome = ethers.encodeBytes32String("YES")

      // Non-adapter should not be able to settle
      await expect(market.connect(user1).settle(outcome)).to.be.revertedWith("Only UMA adapter can settle")

      // Verify market is not settled
      expect(await market.isSettled()).to.equal(false)
    })
  })
})
