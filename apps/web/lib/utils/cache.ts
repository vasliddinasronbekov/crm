/**
 * Frontend Caching Utilities
 *
 * NOTE: Backend already caches analytics (15min) and dashboard stats (5min)
 * Frontend should handle UI-level caching for better UX
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private defaultTTL: number = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data if not expired
   * @param key - Cache key
   * @returns Cached data or null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cache with optional TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL)

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt
    })
  }

  /**
   * Invalidate specific cache key
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate multiple keys matching pattern
   * @param pattern - Regex pattern to match keys
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   * @returns Cache stats
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Check if key exists and is not expired
   * @param key - Cache key
   * @returns True if valid cache exists
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Get data age in milliseconds
   * @param key - Cache key
   * @returns Age in ms or null if not found
   */
  getAge(key: string): number | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    return Date.now() - entry.timestamp
  }

  /**
   * Get remaining TTL in milliseconds
   * @param key - Cache key
   * @returns Remaining TTL or null if not found
   */
  getRemainingTTL(key: string): number | null {
    const entry = this.cache.get(key)
    if (!entry) return null
    return Math.max(0, entry.expiresAt - Date.now())
  }
}

// Singleton instance
const cacheManager = new CacheManager()

/**
 * Cached fetch wrapper
 * @param key - Cache key
 * @param fetcher - Function to fetch data
 * @param ttl - Time to live in milliseconds
 * @returns Cached or fresh data
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try to get from cache first
  const cached = cacheManager.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Fetch fresh data
  const data = await fetcher()

  // Cache it
  cacheManager.set(key, data, ttl)

  return data
}

/**
 * Cached fetch with stale-while-revalidate pattern
 * Returns stale data immediately and fetches fresh data in background
 * @param key - Cache key
 * @param fetcher - Function to fetch data
 * @param ttl - Time to live in milliseconds
 * @returns Promise with cached or fresh data
 */
export async function cachedFetchSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  const cached = cacheManager.get<T>(key)

  // If we have cached data, return it and fetch in background
  if (cached !== null) {
    // Revalidate in background
    fetcher().then(data => {
      cacheManager.set(key, data, ttl)
    }).catch(error => {
      console.error('Background revalidation failed:', error)
    })

    return cached
  }

  // No cache, fetch now
  const data = await fetcher()
  cacheManager.set(key, data, ttl)
  return data
}

/**
 * Invalidate cache for entity
 * Clears all related cache keys
 * @param entity - Entity name (e.g., 'students', 'payments')
 */
export function invalidateEntityCache(entity: string): void {
  cacheManager.invalidatePattern(new RegExp(`^${entity}`))
}

/**
 * Smart cache invalidation based on mutation
 * @param mutation - Mutation type ('create', 'update', 'delete')
 * @param entity - Entity name
 * @param id - Entity ID (optional)
 */
export function invalidateOnMutation(
  mutation: 'create' | 'update' | 'delete',
  entity: string,
  id?: number
): void {
  // Always invalidate list cache
  cacheManager.invalidate(`${entity}_list`)

  // For update/delete, invalidate specific item
  if (id) {
    cacheManager.invalidate(`${entity}_${id}`)
    cacheManager.invalidate(`${entity}_detail_${id}`)
  }

  // Invalidate related caches
  if (entity === 'payments') {
    cacheManager.invalidate('analytics')
    cacheManager.invalidate('dashboard_stats')
    cacheManager.invalidate('financial_summary')
  }

  if (entity === 'students' || entity === 'groups') {
    cacheManager.invalidate('dashboard_stats')
  }
}

// Export singleton
export default cacheManager

// Export common cache keys
export const CACHE_KEYS = {
  DASHBOARD_STATS: 'dashboard_stats',
  ANALYTICS: 'analytics',
  STUDENTS_LIST: 'students_list',
  TEACHERS_LIST: 'teachers_list',
  GROUPS_LIST: 'groups_list',
  PAYMENTS_LIST: 'payments_list',
  COURSES_LIST: 'courses_list',
  BRANCHES_LIST: 'branches_list',
}

// Export common TTLs
export const CACHE_TTL = {
  SHORT: 1 * 60 * 1000,      // 1 minute
  MEDIUM: 5 * 60 * 1000,     // 5 minutes
  LONG: 15 * 60 * 1000,      // 15 minutes
  HOUR: 60 * 60 * 1000,      // 1 hour
}
