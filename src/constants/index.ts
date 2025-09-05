/**
 * Application Constants for Webster Image Scraper
 * Following React/TypeScript industry standards for constant organization
 */

export const TIMING = {
  // Network timeouts (in milliseconds)
  DOWNLOAD_TIMEOUT: 30000,
  FETCH_TIMEOUT: 5000,
  IMAGE_VALIDATION_TIMEOUT: 5000,
  
  // Retry delays for different error types
  RETRY_DELAY: {
    SSL: 2000,
    TIMEOUT: 1500,
    RATE_LIMIT: 1000,
  },
  
  // UI interaction timeouts
  COPY_FEEDBACK_DURATION: 2000,
  NAVIGATION_LOCK_TIMEOUT: 5000,
  EXTENDED_NAVIGATION_LOCK: 10000,
  AUTO_CHAPTER_COOLDOWN: 30000,
  AUTO_NAVIGATION_DELAY: 1000,
  
  // Processing intervals
  SAFETY_CHECK_INTERVAL: 30000,
  SCROLL_THROTTLE_INTERVAL: 16, // 60fps
  PROCESSING_DELAY: 10,
  DOWNLOAD_DELAY_BETWEEN_IMAGES: 250,
  URL_CLEANUP_DELAY: 5000,
  IMAGE_STATE_RESET_DELAY: 10,
} as const

export const DEFAULTS = {
  // Scraping configuration defaults
  FILE_TYPES: ['png', 'jpg', 'jpeg', 'webp'] as const,
  SCRAPING_METHOD: 'fast' as const,
  CONSECUTIVE_MISS_THRESHOLD: 2,
  CHAPTER_COUNT: 1,
  FETCH_INTERVAL_SECONDS: 15,
  SEQUENTIAL_MAX_IMAGES: 100,
  
  // Network configuration
  RETRY_COUNT: 3,
  FETCH_INTERVAL_MS: 15000,
  
  // Validation settings
  BATCH_SIZE: 3,
  
  // UI defaults
  SHOW_SCROLL_BUTTONS: true,
  VALIDATE_IMAGES: false,
} as const

export const THRESHOLDS = {
  // Chapter configuration thresholds
  MIN_CHAPTER_COUNT_FOR_30S_INTERVAL: 15,
  MIN_FETCH_INTERVAL_SECONDS: 15,
  MIN_FETCH_INTERVAL_FOR_BULK: 30,
  
  // UI behavior thresholds
  BOTTOM_SCROLL_THRESHOLD: 10,
  TOP_SCROLL_THRESHOLD: 50,
  
  // HTTP status handling
  HTTP_SUCCESS_THRESHOLD: 400,
  HTTP_RETRY_CODES: [429, 525, 408] as const,
  
  // File and processing limits
  EMPTY_FILE_SIZE: 0,
} as const

export const UI_CONFIG = {
  // Z-index layers for proper stacking
  Z_INDEX: {
    NAVIGATION_OVERLAY: 70,
    PREVIEW_OVERLAY: 40,
    PREVIEW_CONTROLS: 50,
    FLOATING_BUTTONS: 40,
  },
  
  // Local storage keys
  STORAGE_KEYS: {
    IMAGE_FILTERS: 'webster-image-filters',
  },
  
  // CSS class patterns
  GRID_RESPONSIVE: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
} as const

export const FETCH_INTERVALS = {
  // Interval options for different chapter counts (in seconds)
  STANDARD: [15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 200] as const,
  BULK: [30, 45, 60, 75, 90, 120, 150, 180, 200] as const,
} as const

export const CHAPTER_OPTIONS = {
  // Chapter count configuration options
  INDIVIDUAL_RANGE: Array.from({ length: 20 }, (_, i) => i + 1),
  BULK_RANGE: Array.from({ length: 36 }, (_, i) => (i + 5) * 5),
  MISS_THRESHOLD_OPTIONS: [1, 2, 3] as const,
} as const

export const FILE_EXTENSIONS = {
  // Supported file extensions
  AVAILABLE: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'] as const,
  
  // MIME type mappings
  MIME_TYPES: {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    ico: 'image/x-icon',
  } as const,
} as const

export const REGEX_PATTERNS = {
  // Common regex patterns for image scraping
  SEQUENTIAL_IMAGE: /^(.*\/)([0-9]{2,4})\.(jpg|jpeg|png|gif|webp)$/i,
  CHAPTER_EXTRACTION: /(chapter|ch|episode|ep|part|p)[-_]?(\d+)/i,
  NUMBER_EXTRACTION: /^(.*?)(\d+)(.*)$/,
  IMAGE_URL: /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)/gi,
  MARKDOWN_IMAGE: /!\[.*?\]\((.*?)\)/g,
  IMG_TAG: /<img[^>]+>/gi,
} as const

export const ERROR_MESSAGES = {
  // User-facing error messages
  INVALID_URL: 'Please enter a valid URL',
  NO_FILE_TYPES: 'Please select at least one file type',
  
  // Network error messages
  TIMEOUT_ERROR: 'Request timed out after 5 seconds. Server may be slow or unreachable.',
  NETWORK_ERROR: 'Network error or website is unreachable',
  CORS_ERROR: 'Unable to access website due to security restrictions',
  
  // Scraping error messages
  EMPTY_RESPONSE: 'No images found on this page',
  SCRAPING_FAILED: 'Failed to scrape images',
  CHAPTER_NOT_FOUND: 'Chapter not found',
  ACCESS_FORBIDDEN: 'Access forbidden',
  
  // Validation messages
  EMPTY_FILE: 'File is empty or corrupted',
  INVALID_FILE_TYPE: 'Invalid file type',
} as const

// Type exports for better TypeScript integration
export type FileExtension = typeof FILE_EXTENSIONS.AVAILABLE[number]
export type ScrapingMethod = typeof DEFAULTS.SCRAPING_METHOD | 'smart'
export type MimeType = keyof typeof FILE_EXTENSIONS.MIME_TYPES
export type HttpRetryCode = typeof THRESHOLDS.HTTP_RETRY_CODES[number]

// Utility functions for working with constants
export const isValidFileExtension = (ext: string): ext is FileExtension => {
  return FILE_EXTENSIONS.AVAILABLE.includes(ext as FileExtension)
}

export const getMimeType = (extension: string): string => {
  const cleanExt = extension.replace('.', '').toLowerCase()
  return FILE_EXTENSIONS.MIME_TYPES[cleanExt as MimeType] || 'application/octet-stream'
}

export const shouldRetryHttpStatus = (status: number): boolean => {
  return THRESHOLDS.HTTP_RETRY_CODES.includes(status as HttpRetryCode)
}

export const getFetchIntervals = (chapterCount: number) => {
  return chapterCount >= THRESHOLDS.MIN_CHAPTER_COUNT_FOR_30S_INTERVAL
    ? FETCH_INTERVALS.BULK
    : FETCH_INTERVALS.STANDARD
}

export const getMinFetchInterval = (chapterCount: number): number => {
  return chapterCount >= THRESHOLDS.MIN_CHAPTER_COUNT_FOR_30S_INTERVAL
    ? THRESHOLDS.MIN_FETCH_INTERVAL_FOR_BULK
    : THRESHOLDS.MIN_FETCH_INTERVAL_SECONDS
}