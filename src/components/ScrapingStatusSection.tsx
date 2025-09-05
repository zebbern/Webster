import React from 'react'
import { AlertCircle, CheckCircle } from 'lucide-react'
import ProgressIndicator from './ProgressIndicator'
import { ScrapeProgress } from '../utils/advancedImageScraper'

interface ScrapingStatusSectionProps {
  progress: ScrapeProgress | null
  error: string | null
  imageCount: number
  stats: {
    total: number
    duplicates: number
    filtered: number
  }
  filteredCount: number
  displayedCount: number
}

export const ScrapingStatusSection = React.memo(({
  progress,
  error,
  imageCount,
  stats,
  filteredCount,
  displayedCount
}: ScrapingStatusSectionProps) => {
  // Don't render if no status to show
  if (!progress && !error && imageCount === 0) {
    return null
  }

  return (
    <div className="space-y-6 mb-6">
      {/* Progress */}
      {progress && (
        <div>
          <ProgressIndicator progress={progress} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center space-x-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Stats */}
      {imageCount > 0 && (
        <div className="flex items-center space-x-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <div className="flex items-center space-x-2 text-accent">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">{stats.total} images found</span>
          </div>
          <div className="text-sm text-accent/80">
            {displayedCount} displayed • {filteredCount} filtered out • {stats.duplicates} duplicates removed
          </div>
        </div>
      )}
    </div>
  )
})

ScrapingStatusSection.displayName = 'ScrapingStatusSection'