// Fee calculation utilities

export const FEE_PERCENTAGE = 0.01 // 1%

/**
 * Calculate fee amount and net amount after fee deduction
 */
export function calculateFeeAndNetAmount(originalAmount: number): {
  feeAmount: number
  netAmount: number
  feePercentage: number
} {
  const feeAmount = originalAmount * FEE_PERCENTAGE
  const netAmount = originalAmount - feeAmount

  return {
    feeAmount,
    netAmount,
    feePercentage: FEE_PERCENTAGE,
  }
}

/**
 * Calculate shares received after fee deduction
 * The fee reduces the effective amount used for share calculation
 */
export function calculateSharesAfterFee(
  originalAmount: number,
  qy: number,
  qn: number,
  b: number,
  side: boolean,
  calculateSharesToBuy: (V: number, qy: number, qn: number, b: number, side: boolean) => number,
): {
  shares: number
  feeAmount: number
  netAmount: number
  effectiveAmount: number
} {
  const { feeAmount, netAmount } = calculateFeeAndNetAmount(originalAmount)

  // Use net amount (after fee) for share calculation
  const shares = calculateSharesToBuy(netAmount, qy, qn, b, side)

  return {
    shares,
    feeAmount,
    netAmount,
    effectiveAmount: netAmount,
  }
}

/**
 * Calculate sell value after fee deduction
 */
export function calculateSellValueAfterFee(
  sharesToSell: number,
  qy: number,
  qn: number,
  b: number,
  side: boolean,
  calculateSellValue: (delta: number, qy: number, qn: number, b: number, side: boolean) => number,
): {
  grossValue: number
  feeAmount: number
  netValue: number
} {
  const grossValue = calculateSellValue(sharesToSell, qy, qn, b, side)
  const { feeAmount, netAmount } = calculateFeeAndNetAmount(grossValue)

  return {
    grossValue,
    feeAmount,
    netValue: netAmount,
  }
}

/**
 * Fee record for database insertion
 */
export interface FeeRecord {
  user_id: string
  market_id: string
  transaction_type: "buy" | "sell"
  original_amount: number
  fee_amount: number
  fee_percentage: number
  net_amount: number
}
