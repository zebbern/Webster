/**
 * TypeScript interfaces for scraping-related types
 * Following React/TypeScript industry standards for type organization
 */

// Import types that are used in interface definitions
import type { ScrapedImage, ScrapeProgress } from '../utils/advancedImageScraper'
import type { ChapterInfo } from '../utils/urlNavigation'

export interface ScrapingStats {
  total: number
  duplicates: number
  filtered: number
}

export interface SequentialPattern {
  basePath: string
  extension: string
  pad: number
}

export interface ScrapingState {
  images: ScrapedImage[]
  progress: ScrapeProgress | null
  isLoading: boolean
  error: string | null
  stats: ScrapingStats
  sequentialPattern: SequentialPattern | null
  isImageStateResetting: boolean
}

export interface ScrapingActions {
  handleProgress: (progress: ScrapeProgress | null) => void
  handleNewImage: (image: ScrapedImage) => void
  removeImageOnError: (url: string) => void
  resetState: () => Promise<void>
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setSequentialPattern: (pattern: SequentialPattern | null) => void
  setStats: (stats: ScrapingStats) => void
}

export interface NavigationState {
  isNavigating: boolean
  lastPageUrl: string | null
  lastAutoScrollTime: number
  lastPreviewEnterTime: number
}

export interface NavigationActions {
  setNavigating: (navigating: boolean) => void
  updateChapterUrl: (chapterNumber: number, immediate?: boolean) => string
  startNavigation: () => void
  updateLastScrollTime: (time: number) => void
  updatePreviewEnterTime: (time: number) => void
}

export interface ScrapingConfiguration {
  scrapingMethod: 'smart' | 'fast'
  fileTypes: string[]
  chapterCount: number
  consecutiveMissThreshold: number
  validateImages: boolean
  fetchInterval: number
  showScrollButtons: boolean
  autoNextChapter: boolean
}

export interface ConfigurationActions {
  updateScrapingMethod: (method: 'smart' | 'fast') => void
  updateFileTypes: (types: string[]) => void
  updateChapterCount: (count: number) => void
  updateConsecutiveMissThreshold: (threshold: number) => void
  updateValidateImages: (validate: boolean) => void
  updateFetchInterval: (interval: number) => void
  updateShowScrollButtons: (show: boolean) => void
  updateAutoNextChapter: (auto: boolean) => void
  toggleFileType: (type: string) => void
}

export interface UIState {
  showConfiguration: boolean
  showUrlPatterns: boolean
  showImageFilters: boolean
  previewActive: boolean
  tooltipStates: Record<string, boolean>
}

export interface UIActions {
  toggleConfiguration: () => void
  toggleUrlPatterns: () => void
  toggleImageFilters: () => void
  setPreviewActive: (active: boolean) => void
  toggleTooltip: (key: string) => void
}

export interface FilterState {
  imageFilters: string[]
  newFilter: string
  customUrlPatterns: string
}

export interface FilterActions {
  addFilter: (filter: string) => void
  removeFilter: (filter: string) => void
  clearAllFilters: () => void
  shouldFilterImage: (url: string) => boolean
  setNewFilter: (filter: string) => void
  setCustomUrlPatterns: (patterns: string) => void
  applyUrlPatterns: () => void
  exportUrlPatterns: () => void
}

// Re-export types from other modules for convenience
export type { ScrapedImage, ScrapeProgress, ChapterInfo }