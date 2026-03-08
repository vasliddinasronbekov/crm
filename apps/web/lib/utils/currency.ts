export type CurrencyCode = 'USD' | 'UZS' | 'RUB' | 'EUR'
export type AppLanguage = 'en' | 'uz' | 'ru'

export const currencySymbols: Record<CurrencyCode, string> = {
  USD: '$',
  UZS: "so'm",
  RUB: '₽',
  EUR: '€',
}

export const defaultCurrencyRatesFromUzs: Record<CurrencyCode, number> = {
  UZS: 1,
  USD: 1 / 12600,
  EUR: 1 / 13700,
  RUB: 1 / 140,
}

const supportedCurrencies: CurrencyCode[] = ['USD', 'UZS', 'RUB', 'EUR']

const localeByLanguage: Record<AppLanguage, string> = {
  en: 'en-US',
  uz: 'uz-UZ',
  ru: 'ru-RU',
}

export function normalizeRatesFromUzs(
  rates?: Partial<Record<string, number>> | null,
): Record<CurrencyCode, number> {
  const normalized: Record<CurrencyCode, number> = { ...defaultCurrencyRatesFromUzs }

  if (!rates) {
    return normalized
  }

  supportedCurrencies.forEach((currency) => {
    const raw = rates[currency]
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
      normalized[currency] = raw
    }
  })

  normalized.UZS = 1
  return normalized
}

export function convertFromUzs(
  amountInUzs: number,
  targetCurrency: CurrencyCode,
  ratesFromUzs: Record<CurrencyCode, number>,
): number {
  const safeAmount = Number.isFinite(amountInUzs) ? amountInUzs : 0
  const rate = ratesFromUzs[targetCurrency] || 1
  return safeAmount * rate
}

export function convertToUzs(
  amountInSelectedCurrency: number,
  sourceCurrency: CurrencyCode,
  ratesFromUzs: Record<CurrencyCode, number>,
): number {
  const safeAmount = Number.isFinite(amountInSelectedCurrency) ? amountInSelectedCurrency : 0
  const rate = ratesFromUzs[sourceCurrency] || 1
  if (!Number.isFinite(rate) || rate <= 0) {
    return safeAmount
  }
  return safeAmount / rate
}

type FormatCurrencyOptions = {
  currency: CurrencyCode
  language: AppLanguage
  ratesFromUzs: Record<CurrencyCode, number>
  minimumFractionDigits?: number
  maximumFractionDigits?: number
}

export function formatFromUzs(amountInUzs: number, options: FormatCurrencyOptions): string {
  const {
    currency,
    language,
    ratesFromUzs,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options

  const locale = localeByLanguage[language] || 'en-US'
  const converted = convertFromUzs(amountInUzs, currency, ratesFromUzs)
  const symbol = currencySymbols[currency]
  const sign = converted < 0 ? '-' : ''
  const absoluteAmount = Math.abs(converted)

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(absoluteAmount)

  if (currency === 'UZS') {
    return `${sign}${formatted} ${symbol}`
  }

  return `${sign}${symbol}${formatted}`
}
