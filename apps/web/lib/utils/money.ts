/**
 * Money Conversion Utilities
 *
 * CRITICAL: Backend stores all money in TIYIN (100 tiyin = 1 UZS)
 * Always convert when displaying or sending money!
 */

/**
 * Convert tiyin to UZS for display
 * @param tiyin - Amount in tiyin (from backend)
 * @returns Amount in UZS
 */
export function tiyinToUzs(tiyin: number): number {
  return tiyin / 100
}

/**
 * Convert UZS to tiyin for sending to backend
 * @param uzs - Amount in UZS (from user input)
 * @returns Amount in tiyin
 */
export function uzsToTiyin(uzs: number): number {
  return Math.round(uzs * 100)
}

/**
 * Format money for display
 * @param tiyin - Amount in tiyin
 * @param currency - Currency symbol (default: 'UZS')
 * @param showDecimals - Whether to show decimal places
 * @returns Formatted string
 */
export function formatMoney(
  tiyin: number,
  currency: string = 'UZS',
  showDecimals: boolean = true
): string {
  const uzs = tiyinToUzs(tiyin)
  const formatted = showDecimals
    ? uzs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : uzs.toLocaleString('en-US', { maximumFractionDigits: 0 })

  return `${formatted} ${currency}`
}

/**
 * Format money as currency with symbol
 * @param tiyin - Amount in tiyin
 * @returns Formatted string with $ symbol
 */
export function formatCurrency(tiyin: number, currency: string = 'UZS'): string {
  const uzs = tiyinToUzs(tiyin)
  return `${uzs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

/**
 * Parse user input to tiyin
 * Handles various input formats: "100", "100.50", "100,50"
 * @param input - User input string
 * @returns Amount in tiyin, or null if invalid
 */
export function parseMoneyInput(input: string): number | null {
  const cleaned = input.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const parsed = parseFloat(cleaned)

  if (isNaN(parsed)) {
    return null
  }

  return uzsToTiyin(parsed)
}

/**
 * Calculate percentage
 * @param amount - Amount in tiyin
 * @param total - Total in tiyin
 * @returns Percentage (0-100)
 */
export function calculatePercentage(amount: number, total: number): number {
  if (total === 0) return 0
  return Math.round((amount / total) * 100)
}

/**
 * Format large numbers with K/M suffix
 * @param tiyin - Amount in tiyin
 * @returns Formatted string (e.g., "1.5M UZS")
 */
export function formatCompactMoney(tiyin: number, currency: string = 'UZS'): string {
  const uzs = tiyinToUzs(tiyin)

  if (uzs >= 1_000_000) {
    return `${(uzs / 1_000_000).toFixed(1)}M ${currency}`
  }

  if (uzs >= 1_000) {
    return `${(uzs / 1_000).toFixed(1)}K ${currency}`
  }

  return `${uzs.toFixed(0)} ${currency}`
}

/**
 * Calculate balance status
 * @param balance - Balance in tiyin (positive = debt, negative = overpaid)
 * @returns Status object
 */
export function getBalanceStatus(balance: number): {
  status: 'paid' | 'partial' | 'debt'
  color: string
  label: string
} {
  if (balance <= 0) {
    return {
      status: 'paid',
      color: 'text-success',
      label: 'Fully Paid'
    }
  }

  if (balance > 0) {
    return {
      status: 'debt',
      color: 'text-error',
      label: 'Outstanding'
    }
  }

  return {
    status: 'partial',
    color: 'text-warning',
    label: 'Partial'
  }
}
