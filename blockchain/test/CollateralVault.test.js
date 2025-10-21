const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("CollateralVault Contract", () => {
  let vault, usdc
  let owner, user1, user2, market

  beforeEach(async () => {
    ;[owner, user1, user2, market] = await ethers.getSigners()

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20")
    usdc = await MockERC20.deploy("Mock USDC", "USDC", 6)
    await usdc.waitForDeployment()

    // Deploy CollateralVault
    const CollateralVault = await ethers.getContractFactory("CollateralVault")
    vault = await CollateralVault.deploy(await usdc.getAddress())
    await vault.waitForDeployment()

    // Mint USDC to users
    await usdc.mint(user1.address, ethers.parseUnits("1000", 6))
    await usdc.mint(user2.address, ethers.parseUnits("1000", 6))
  })

  describe("Deposits", () => {
    it("Should allow users to deposit USDC", async () => {
      const depositAmount = ethers.parseUnits("100", 6)

      // Approve vault to spend USDC
      await usdc.connect(user1).approve(await vault.getAddress(), depositAmount)

      // Deposit
      await expect(vault.connect(user1).deposit(depositAmount))
        .to.emit(vault, "Deposited")
        .withArgs(user1.address, depositAmount)

      // Check balance
      expect(await vault.balances(user1.address)).to.equal(depositAmount)
    })

    it("Should reject deposits without approval", async () => {
      const depositAmount = ethers.parseUnits("100", 6)

      await expect(vault.connect(user1).deposit(depositAmount)).to.be.reverted
    })
  })

  describe("Withdrawals", () => {
    beforeEach(async () => {
      // User1 deposits 100 USDC
      const depositAmount = ethers.parseUnits("100", 6)
      await usdc.connect(user1).approve(await vault.getAddress(), depositAmount)
      await vault.connect(user1).deposit(depositAmount)
    })

    it("Should allow users to withdraw their balance", async () => {
      const withdrawAmount = ethers.parseUnits("50", 6)

      await expect(vault.connect(user1).withdraw(withdrawAmount))
        .to.emit(vault, "Withdrawn")
        .withArgs(user1.address, withdrawAmount)

      expect(await vault.balances(user1.address)).to.equal(ethers.parseUnits("50", 6))
    })

    it("Should reject withdrawals exceeding balance", async () => {
      const withdrawAmount = ethers.parseUnits("200", 6)

      await expect(vault.connect(user1).withdraw(withdrawAmount)).to.be.revertedWith("Insufficient balance")
    })
  })

  describe("Market Reserves", () => {
    beforeEach(async () => {
      // User1 deposits 100 USDC
      const depositAmount = ethers.parseUnits("100", 6)
      await usdc.connect(user1).approve(await vault.getAddress(), depositAmount)
      await vault.connect(user1).deposit(depositAmount)

      await vault.authorizeMarket(market.address)
    })

    it("Should allow markets to reserve collateral", async () => {
      const reserveAmount = ethers.parseUnits("50", 6)

      await expect(vault.connect(market).reserveForMarket(1, user1.address, reserveAmount)).to.emit(vault, "Reserved")

      expect(await vault.getReservedBalance(1, user1.address)).to.equal(reserveAmount)
    })

    it("Should NOT allow non-markets to reserve collateral", async () => {
      const reserveAmount = ethers.parseUnits("50", 6)

      await expect(vault.connect(user2).reserveForMarket(1, user1.address, reserveAmount)).to.be.reverted
    })

    it("Should allow markets to release reserved collateral", async () => {
      const reserveAmount = ethers.parseUnits("50", 6)

      // Reserve
      await vault.connect(market).reserveForMarket(1, user1.address, reserveAmount)

      await expect(vault.connect(market).releaseReserved(1, user1.address, reserveAmount)).to.emit(vault, "Released")

      expect(await vault.getReservedBalance(1, user1.address)).to.equal(0)
    })
  })
})
