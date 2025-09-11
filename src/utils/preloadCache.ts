import { ScrapedImage } from './advancedImageScraper'

export interface CacheEntry {
  images: ScrapedImage[]
  timestamp: number
  url: string
}

export interface PreloadCacheConfig {
  maxAge: number // milliseconds
  maxEntries: number
}

class PreloadCache {
  private cache = new Map<string, CacheEntry>()
  private config: PreloadCacheConfig

  constructor(config: PreloadCacheConfig = { maxAge: 10 * 60 * 1000, maxEntries: 10 }) { // 10 minutes, 10 entries
    this.config = config
  }

  /**
   * Generate cache key from URL and relevant configuration
   */
  private generateKey(url: string, fileTypes: string[], validateImages: boolean): string {
    const fileTypesStr = fileTypes.sort().join(',')
    return `${url}|${fileTypesStr}|${validateImages}`
  }

  /**
   * Check if cache entry is still valid (not expired)
   */
  private isValid(entry: CacheEntry): boolean {
    return (Date.now() - entry.timestamp) < this.config.maxAge
  }

  /**
   * Clean up expired entries and enforce max size
   */
  private cleanup(): void {
    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (!this.isValid(entry)) {
        this.cache.delete(key)
      }
    }

    // Enforce max entries (LRU-like: remove oldest if over limit)
    if (this.cache.size > this.config.maxEntries) {
      const entries = Array.from(this.cache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      
      const toRemove = entries.slice(0, entries.length - this.config.maxEntries)
      toRemove.forEach(([key]) => this.cache.delete(key))
    }
  }

  /**
   * Store images in cache
   */
  store(url: string, images: ScrapedImage[], fileTypes: string[], validateImages: boolean): void {
    if (images.length === 0) return // Don't cache empty results

    const key = this.generateKey(url, fileTypes, validateImages)
    const entry: CacheEntry = {
      images: [...images], // Shallow copy to avoid mutations
      timestamp: Date.now(),
      url
    }

    this.cache.set(key, entry)
    this.cleanup()
  }

  /**
   * Retrieve images from cache if available and valid
   */
  get(url: string, fileTypes: string[], validateImages: boolean): ScrapedImage[] | null {
    const key = this.generateKey(url, fileTypes, validateImages)
    const entry = this.cache.get(key)

    if (!entry || !this.isValid(entry)) {
      if (entry) {
        this.cache.delete(key) // Clean up expired entry
      }
      return null
    }

    return [...entry.images] // Return shallow copy to avoid mutations
  }

  /**
   * Check if URL is cached and valid
   */
  has(url: string, fileTypes: string[], validateImages: boolean): boolean {
    return this.get(url, fileTypes, validateImages) !== null
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; maxAge: number } {
    this.cleanup() // Clean before reporting stats
    return {
      size: this.cache.size,
      maxSize: this.config.maxEntries,
      maxAge: this.config.maxAge
    }
  }
}

// Export singleton instance
export const preloadCache = new PreloadCache()