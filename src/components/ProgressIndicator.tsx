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
    </div>
  )
}

export default ProgressIndicator
