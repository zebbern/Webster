import React from 'react'
import { Search, Settings } from 'lucide-react'
import ChapterNavigation from './ChapterNavigation'
import { parseChapterFromUrl } from '../utils/urlNavigation'

interface ScrapingInputSectionProps {
  url: string
  onUrlChange: (url: string) => void
  onScrape: () => void
  isLoading: boolean
  chapterCount: number
  navTooltipOpen: boolean
  onNavTooltipToggle: (open: boolean) => void
  showConfiguration: boolean
  onToggleConfiguration: () => void
}

export const ScrapingInputSection = React.memo(({
  url,
  onUrlChange,
  onScrape,
  isLoading,
  chapterCount,
  navTooltipOpen,
  onNavTooltipToggle,
  showConfiguration,
  onToggleConfiguration
}: ScrapingInputSectionProps) => {
  return (
    <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
      {/* URL Input Section */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-4 text-center">
          Website URL
          <span className="block text-xs text-muted-foreground font-normal mt-1">
            Works best with manga/comic sites and image galleries
          </span>
        </label>

        <div className="space-y-4">
          {/* URL Input Field */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="url"
              value={url}
              onChange={(e) => onUrlChange(e.target.value)}
              placeholder="https://example.com/chapter-0"
              className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
          </div>

          {/* Chapter Navigation */}
          <ChapterNavigation
            chapterInfo={parseChapterFromUrl(url)}
            chapterCount={chapterCount}
            tooltipOpen={navTooltipOpen}
            onTooltipOpenChange={onNavTooltipToggle}
          />

          {/* Start/Stop Button */}
          <div className="flex justify-center items-center gap-3">
            {!isLoading ? (
              <button
                onClick={onScrape}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center space-x-2 text-base"
                aria-label="Start Scraping"
              >
                <Search className="h-5 w-5" />
                <span>Start Scraping</span>
              </button>
            ) : (
              <button
                onClick={onScrape}
                className="px-8 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium flex items-center space-x-2 text-base"
                aria-label="Stop Scraping"
              >
                <span>Stop Scraping</span>
              </button>
            )}
            
            {/* Configuration Toggle Button */}
            <button
              onClick={onToggleConfiguration}
              className={`p-3 rounded-lg transition-colors font-medium flex items-center justify-center ${
                showConfiguration 
                  ? 'bg-primary/80 text-primary-foreground hover:bg-primary' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
              title={showConfiguration ? 'Hide Configuration' : 'Show Configuration'}
              aria-label="Toggle Configuration"
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

ScrapingInputSection.displayName = 'ScrapingInputSection'