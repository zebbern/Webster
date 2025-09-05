import React from 'react'
import { Settings, Filter, Info } from 'lucide-react'
import ScrapingConfiguration from './ScrapingConfiguration'
import ImageFiltering from './ImageFiltering'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { parseChapterFromUrl } from '../utils/urlNavigation'
import { FILE_EXTENSIONS } from '../constants'

interface ScrapingConfigurationSectionProps {
  // UI State
  showConfiguration: boolean
  onToggleConfiguration: () => void
  
  // URL and Chapter Info
  url: string
  
  // Configuration Props
  scrapingMethod: 'smart' | 'fast'
  onScrapingMethodChange: (method: 'smart' | 'fast') => void
  consecutiveMissThreshold: number
  onConsecutiveMissThresholdChange: (threshold: number) => void
  chapterCount: number
  onChapterCountChange: (count: number) => void
  autoNextChapter: boolean
  onAutoNextChapterChange: (auto: boolean) => void
  fetchInterval: number
  onFetchIntervalChange: (interval: number) => void
  showScrollButtons: boolean
  onShowScrollButtonsChange: (show: boolean) => void
  validateImages: boolean
  onValidateImagesChange: (validate: boolean) => void
  fileTypes: string[]
  onFileTypeToggle: (type: string) => void
  
  // Loading State
  isLoading: boolean
  
  // Tooltip State
  tooltipStates: Record<string, boolean>
  onTooltipToggle: (key: string) => void
  
  // URL Pattern Configuration
  showUrlPatterns: boolean
  onToggleUrlPatterns: () => void
  customUrlPatterns: string
  onCustomUrlPatternsChange: (patterns: string) => void
  onUrlPatternsApply: () => void
  onUrlPatternsExport: () => void
  
  // Image Filtering
  showImageFilters: boolean
  onToggleImageFilters: () => void
  imageFilters: string[]
  newFilter: string
  onNewFilterChange: (filter: string) => void
  onAddFilter: () => void
  onRemoveFilter: (filter: string) => void
  onClearAllFilters: () => void
}

export const ScrapingConfigurationSection = React.memo(({
  showConfiguration,
  onToggleConfiguration,
  url,
  scrapingMethod,
  onScrapingMethodChange,
  consecutiveMissThreshold,
  onConsecutiveMissThresholdChange,
  chapterCount,
  onChapterCountChange,
  autoNextChapter,
  onAutoNextChapterChange,
  fetchInterval,
  onFetchIntervalChange,
  showScrollButtons,
  onShowScrollButtonsChange,
  validateImages,
  onValidateImagesChange,
  fileTypes,
  onFileTypeToggle,
  isLoading,
  tooltipStates,
  onTooltipToggle,
  showUrlPatterns,
  onToggleUrlPatterns,
  customUrlPatterns,
  onCustomUrlPatternsChange,
  onUrlPatternsApply,
  onUrlPatternsExport,
  showImageFilters,
  onToggleImageFilters,
  imageFilters,
  newFilter,
  onNewFilterChange,
  onAddFilter,
  onRemoveFilter,
  onClearAllFilters
}: ScrapingConfigurationSectionProps) => {
  if (!showConfiguration) {
    return null
  }

  const chapterInfo = parseChapterFromUrl(url)

  return (
    <div className="mb-6 bg-accent/5 border border-accent/20 rounded-xl p-6 space-y-6">
      {/* Configuration Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-accent/20">
        <Settings className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-foreground">Configuration</h3>
      </div>
      
      {/* Current Settings Display */}
      {chapterInfo.hasChapter && (
        <div className="mb-6 p-3 bg-accent/10 border border-accent/20 rounded-lg text-center">
          <div className="flex items-center justify-center space-x-2 text-sm text-foreground">
            <span>📖</span>
            <span>Chapter {chapterInfo.chapterNumber} detected - Will fetch {chapterCount} chapter(s) per action</span>
          </div>
        </div>
      )}
      
      {/* Scraping Configuration Component */}
      <ScrapingConfiguration
        scrapingMethod={scrapingMethod}
        onScrapingMethodChange={onScrapingMethodChange}
        consecutiveMissThreshold={consecutiveMissThreshold}
        onConsecutiveMissThresholdChange={onConsecutiveMissThresholdChange}
        chapterCount={chapterCount}
        onChapterCountChange={onChapterCountChange}
        autoNextChapter={autoNextChapter}
        onAutoNextChapterChange={onAutoNextChapterChange}
        fetchInterval={fetchInterval}
        onFetchIntervalChange={onFetchIntervalChange}
        showScrollButtons={showScrollButtons}
        onShowScrollButtonsChange={onShowScrollButtonsChange}
        validateImages={validateImages}
        onValidateImagesChange={onValidateImagesChange}
        fileTypes={fileTypes}
        availableFileTypes={FILE_EXTENSIONS.AVAILABLE}
        onFileTypeToggle={onFileTypeToggle}
        isLoading={isLoading}
        tooltipStates={tooltipStates}
        onTooltipToggle={onTooltipToggle}
      />
      
      {/* URL Pattern Configuration */}
      <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <label className="text-sm font-medium text-foreground">URL Patterns</label>
            <Tooltip open={tooltipStates.urlPatterns} onOpenChange={(open) => onTooltipToggle('urlPatterns')}>
              <TooltipTrigger asChild>
                <button className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="URL patterns info">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-xs max-w-64">
                  <div className="font-medium mb-1">Custom URL Patterns</div>
                  <div>Configure custom chapter URL patterns for specific websites. Use .env format with domain-specific templates.</div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <button
            onClick={onToggleUrlPatterns}
            className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
          >
            {showUrlPatterns ? 'Hide' : 'Configure'}
          </button>
        </div>
        
        {showUrlPatterns && (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Pattern Configuration (.env format)</label>
              <textarea
                value={customUrlPatterns}
                onChange={(e) => onCustomUrlPatternsChange(e.target.value)}
                placeholder={`# Example URL patterns:
# manga-site.com
url=https://manga-site.com/manga/title/chapter-1
config=/manga/title/chapter-{chapter}

# comic-reader.net  
url=https://comic-reader.net/comics/title/ch-001
config=/comics/title/ch-{chapter:03d}`}
                className="w-full h-24 px-3 py-2 text-xs bg-input border border-border rounded-md text-foreground font-mono resize-none"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={onUrlPatternsApply}
                disabled={isLoading || !customUrlPatterns.trim()}
                className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Apply Patterns
              </button>
              <button
                onClick={onUrlPatternsExport}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
              >
                Export Current
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Image Filtering Section */}
      <ImageFiltering
        imageFilters={imageFilters}
        newFilter={newFilter}
        showImageFilters={showImageFilters}
        isLoading={isLoading}
        tooltipOpen={tooltipStates.imageFiltering}
        onTooltipOpenChange={(open) => onTooltipToggle('imageFiltering')}
        onNewFilterChange={onNewFilterChange}
        onShowFiltersToggle={onToggleImageFilters}
        onAddFilter={onAddFilter}
        onRemoveFilter={onRemoveFilter}
        onClearAllFilters={onClearAllFilters}
      />
    </div>
  )
})

ScrapingConfigurationSection.displayName = 'ScrapingConfigurationSection'