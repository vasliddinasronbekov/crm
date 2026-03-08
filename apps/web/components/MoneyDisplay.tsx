/**
 * Money Display Components
 * Properly formatted money display with tiyin conversion
 */

'use client'

import { tiyinToUzs, formatCompactMoney, getBalanceStatus } from '@/lib/utils/money'
import { useSettings } from '@/contexts/SettingsContext'

interface MoneyDisplayProps {
  tiyin: number | null | undefined
  compact?: boolean
  currency?: string
  showDecimals?: boolean
  className?: string
}

export function MoneyDisplay({
  tiyin,
  compact = false,
  currency = 'UZS',
  showDecimals = true,
  className = '',
}: MoneyDisplayProps) {
  const { currency: selectedCurrency, formatCurrencyFromMinor } = useSettings()

  if (tiyin === null || tiyin === undefined) {
    return <span className={className}>{formatCurrencyFromMinor(0)}</span>
  }

  const formatted = compact
    ? formatCompactMoney(tiyin, selectedCurrency)
    : formatCurrencyFromMinor(tiyin, {
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
      })

  return <span className={className}>{formatted}</span>
}

interface BalanceDisplayProps {
  balance: number | null | undefined
  showLabel?: boolean
  className?: string
}

export function BalanceDisplay({
  balance,
  showLabel = false,
  className = '',
}: BalanceDisplayProps) {
  const { formatCurrencyFromMinor } = useSettings()

  if (balance === null || balance === undefined) {
    return <span className={className}>{formatCurrencyFromMinor(0)}</span>
  }

  const status = getBalanceStatus(balance)
  const formatted = formatCurrencyFromMinor(Math.abs(balance))

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={status.color}>
        {balance > 0 ? '-' : '+'}{formatted}
      </span>
      {showLabel && (
        <span className={`text-xs px-2 py-1 rounded ${
          status.status === 'paid' ? 'bg-success/20 text-success' :
          status.status === 'debt' ? 'bg-error/20 text-error' :
          'bg-warning/20 text-warning'
        }`}>
          {status.label}
        </span>
      )}
    </div>
  )
}

interface MoneyInputProps {
  value: number | null | undefined
  onChange: (tiyin: number) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  min?: number
  max?: number
}

export function MoneyInput({
  value,
  onChange,
  placeholder = '0.00',
  className = '',
  disabled = false,
  min,
  max,
}: MoneyInputProps) {
  const { currency, toSelectedCurrency, fromSelectedCurrency } = useSettings()
  const amountInSelectedCurrency = value ? toSelectedCurrency(tiyinToUzs(value)) : ''

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/[^\d.]/g, '')
    const parsed = parseFloat(input) || 0

    // Apply min/max constraints
    let finalValue = parsed
    if (min !== undefined && finalValue < min) finalValue = min
    if (max !== undefined && finalValue > max) finalValue = max

    const amountInUzs = fromSelectedCurrency(finalValue)
    onChange(Math.round(amountInUzs * 100))
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={amountInSelectedCurrency}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-4 py-2 pr-16 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 ${className}`}
      />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary text-sm">
        {currency}
      </span>
    </div>
  )
}
