// LMSR (Logarithmic Market Scoring Rule) utility functions
// Implements the pricing mechanism as specified

import { calculateSharesAfterFee, calculateSellValueAfterFee } from "./fees"

/**
 * Calculate the probability of YES outcome using LMSR formula
 * pyes = e^(qy/b) / (e^(qy/b) + e^(qn/b))
 */
export function calculateYesProbability(qy: number, qn: number, b: number): number {
  const expQyB = Math.exp(qy / b)
  const expQnB = Math.exp(qn / b)
  return expQyB / (expQyB + expQnB)
}

/**
 * Calculate the probability of NO outcome using LMSR formula
 * pno = 1 - pyes or equivalently pno = e^(qn/b) / (e^(qy/b) + e^(qn/b))
 */
export function calculateNoProbability(qy: number, qn: number, b: number): number {
  return 1 - calculateYesProbability(qy, qn, b)
}

/**
 * Calculate the cost function C(q) = b * ln(e^(qy/b) + e^(qn/b))
 */
export function calculateCost(qy: number, qn: number, b: number): number {
  const expQyB = Math.exp(qy / b)
  const expQnB = Math.exp(qn / b)
  return b * Math.log(expQyB + expQnB)
}

/**
 * Calculate number of shares to buy for YES side given a value V
 * Formula: shares = b*ln(e^(V/b) * (e^(qy/b)+e^(qn/b)) - e^(qn/b)) - qy
 */
export function calculateSharesToBuyYes(V: number, qy: number, qn: number, b: number): number {
  const expVB = Math.exp(V / b)
  const expQyB = Math.exp(qy / b)
  const expQnB = Math.exp(qn / b)

  const term1 = expVB * (expQyB + expQnB)
  const term2 = term1 - expQnB

  if (term2 <= 0) {
    throw new Error("Invalid calculation: term2 must be positive")
  }

  return b * Math.log(term2) - qy
}

/**
 * Calculate number of shares to buy for NO side given a value V
 * Formula: shares = b*ln(e^(V/b) * (e^(qy/b)+e^(qn/b)) - e^(qy/b)) - qn
 */
export function calculateSharesToBuyNo(V: number, qy: number, qn: number, b: number): number {
  const expVB = Math.exp(V / b)
  const expQyB = Math.exp(qy / b)
  const expQnB = Math.exp(qn / b)

  const term1 = expVB * (expQyB + expQnB)
  const term2 = term1 - expQyB

  if (term2 <= 0) {
    throw new Error("Invalid calculation: term2 must be positive")
  }

  return b * Math.log(term2) - qn
}

/**
 * Calculate value received when selling YES shares
 * Formula: V = b*ln(e^(qy/b)+e^(qn/b)) - b*ln(e^((qy-delta)/b)+e^(qn/b))
 */
export function calculateSellValueYes(delta: number, qy: number, qn: number, b: number): number {
  if (delta > qy) {
    throw new Error("Cannot sell more shares than available")
  }

  const costBefore = calculateCost(qy, qn, b)
  const costAfter = calculateCost(qy - delta, qn, b)

  return costBefore - costAfter
}

/**
 * Calculate value received when selling NO shares
 * Formula: V = b*ln(e^(qy/b)+e^(qn/b)) - b*ln(e^(qy/b)+e^((qn-delta)/b))
 */
export function calculateSellValueNo(delta: number, qy: number, qn: number, b: number): number {
  if (delta > qn) {
    throw new Error("Cannot sell more shares than available")
  }

  const costBefore = calculateCost(qy, qn, b)
  const costAfter = calculateCost(qy, qn - delta, b)

  return costBefore - costAfter
}

/**
 * Calculate the price per share for a given trade
 */
export function calculatePricePerShare(value: number, shares: number): number {
  if (shares <= 0) {
    throw new Error("Shares must be positive")
  }
  return value / shares
}

/**
 * Helper function to get shares to buy based on side
 */
export function calculateSharesToBuy(V: number, qy: number, qn: number, b: number, side: boolean): number {
  return side ? calculateSharesToBuyYes(V, qy, qn, b) : calculateSharesToBuyNo(V, qy, qn, b)
}

/**
 * Helper function to get sell value based on side
 */
export function calculateSellValue(delta: number, qy: number, qn: number, b: number, side: boolean): number {
  return side ? calculateSellValueYes(delta, qy, qn, b) : calculateSellValueNo(delta, qy, qn, b)
}

/**
 * Get current market odds as percentages
 */
export function getMarketOdds(qy: number, qn: number, b: number) {
  const yesProb = calculateYesProbability(qy, qn, b)
  const noProb = calculateNoProbability(qy, qn, b)

  return {
    yesPercent: yesProb * 100,
    noPercent: noProb * 100,
    yesProbability: yesProb,
    noProbability: noProb,
  }
}

/**
 * Calculate the LMSR b parameter from liquidity amount
 * Formula: b = (liquidity_amount / ln(2)) - 1
 */
export function calculateBFromLiquidity(liquidityAmount: number): number {
  return liquidityAmount / Math.log(2) - 1
}

export const DEFAULT_LIQUIDITY_AMOUNT = 100

/**
 * Calculate LMSR prices for both YES and NO sides
 * Returns prices as decimals (0-1 range)
 */
export function calculateLMSRPrices(qy: number, qn: number, liquidityAmount = DEFAULT_LIQUIDITY_AMOUNT) {
  const b = calculateBFromLiquidity(liquidityAmount)
  const yesProb = calculateYesProbability(qy, qn, b)
  const noProb = calculateNoProbability(qy, qn, b)

  return {
    yes: yesProb,
    no: noProb,
  }
}

/**
 * Calculate shares to buy with fee deduction
 * Returns both the shares and fee information
 */
export function calculateSharesToBuyWithFee(
  originalAmount: number,
  qy: number,
  qn: number,
  b: number,
  side: boolean,
): {
  shares: number
  feeAmount: number
  netAmount: number
  effectiveAmount: number
} {
  return calculateSharesAfterFee(originalAmount, qy, qn, b, side, calculateSharesToBuy)
}

/**
 * Calculate sell value with fee deduction
 * Returns both the net value and fee information
 */
export function calculateSellValueWithFee(
  sharesToSell: number,
  qy: number,
  qn: number,
  b: number,
  side: boolean,
): {
  grossValue: number
  feeAmount: number
  netValue: number
} {
  return calculateSellValueAfterFee(sharesToSell, qy, qn, b, side, calculateSellValue)
}

export { calculateYesProbability as calculateLMSRProbability }
