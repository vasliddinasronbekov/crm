const DEFAULT_API_ORIGIN = 'https://api.crmai.uz'

const resolveApiOrigin = () => {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || `${DEFAULT_API_ORIGIN}/api/`

  try {
    return new URL(rawApiUrl).origin
  } catch {
    return DEFAULT_API_ORIGIN
  }
}

/**
 * Converts backend-relative asset URLs (e.g. /media/...) to absolute API URLs.
 */
export const resolveApiAssetUrl = (value?: string | null) => {
  if (!value) return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`
  }

  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return `${resolveApiOrigin()}${normalizedPath}`
}
