import React from 'react'
import { Loader2, Globe, Image as ImageIcon } from 'lucide-react'
import { ScrapeProgress } from '../utils/advancedImageScraper'

interface ProgressIndicatorProps {
  progress: ScrapeProgress
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({ progress }) => {
  const getProgressPercentage = () => {
    if (progress.total === 0) return 0
    return Math.round((progress.processed / progress.total) * 100)
  }

  const getStatusIcon = () => {
    switch (progress.stage) {
      case 'loading':
        return <Globe className="h-5 w-5 text-primary" />
      case 'scanning':
        return <ImageIcon className="h-5 w-5 text-accent" />
      case 'analyzing':
        return <Loader2 className="h-5 w-5 text-orange-500 animate-spin" />
      case 'processing':
        return <Loader2 className="h-5 w-5 text-accent animate-spin" />
      default:
        return <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
    }
  }

  const getStatusText = () => {
    switch (progress.stage) {
      case 'loading':
        return 'Loading website...'
      case 'scanning':
        return 'Scanning for images...'
      case 'analyzing':
        return 'Analyzing for dynamic content...'
      case 'processing':
        return 'Processing images...'
      default:
        return 'Working...'
    }
  }

  return (
    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
      <div className="flex items-center space-x-3 mb-3">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-foreground">
              {getStatusText()}
            </span>
            <span className="text-sm text-muted-foreground">
              {progress.processed} / {progress.total}
            </span>
          </div>
          {progress.currentUrl && (
            <div className="text-xs text-muted-foreground truncate" title={progress.currentUrl}>
              {progress.currentUrl}
            </div>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${getProgressPercentage()}%` }}
        />
      </div>
      
      {/* Stats */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{getProgressPercentage()}% complete</span>
        {progress.found > 0 && (
          <span>{progress.found} images found</span>
        )}
      </div>
      
      {/* Chapter Results */}
      {progress.chapterResults && progress.chapterResults.length > 1 && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-xs font-medium text-foreground mb-2">Chapter Progress</div>
          <div className="flex items-center space-x-1 flex-wrap gap-1">
            {progress.chapterResults.map((result) => (
              <div
                key={result.chapterNumber}
                className={`px-2 py-1 rounded text-xs font-medium ${
                  result.success 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                }`}
                title={result.success ? `Chapter ${result.chapterNumber}: ${result.imageCount} images` : `Chapter ${result.chapterNumber}: ${result.error}`}
              >
                Ch{result.chapterNumber}{result.success ? ` (${result.imageCount})` : ' ✗'}
              </div>
            ))}
          </div>
          {progress.failedChapters && progress.failedChapters.length > 0 && (
            <div className="text-xs text-red-600 dark:text-red-400 mt-1">
              Failed: {progress.failedChapters.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ProgressIndicator
