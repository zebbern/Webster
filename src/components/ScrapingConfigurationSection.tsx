import React, { useState } from 'react'
import { Settings, Filter, Info, Globe, Zap, ChevronDown, Search } from 'lucide-react'
import ScrapingConfiguration from './ScrapingConfiguration'
import ImageFiltering from './ImageFiltering'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { parseChapterFromUrl } from '../utils/urlNavigation'
import { FILE_EXTENSIONS } from '../constants'
import { PREDEFINED_WEBSITE_PATTERNS, WebsitePattern, convertToEnvFormat, detectWebsitePattern, autoDetectUrlPattern } from '../constants/websitePatterns'

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
  fetchInterval: number
  onFetchIntervalChange: (interval: number) => void
  showScrollButtons: boolean
  onShowScrollButtonsChange: (show: boolean) => void
  validateImages: boolean
  onValidateImagesChange: (validate: boolean) => void
  backgroundPreloading: boolean
  onBackgroundPreloadingChange: (enabled: boolean) => void
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
  const [selectedWebsitePattern, setSelectedWebsitePattern] = useState<WebsitePattern | null>(null)
  const [isPatternDropdownOpen, setIsPatternDropdownOpen] = useState(false)
  const [showAdvancedPatterns, setShowAdvancedPatterns] = useState(false)

  const chapterInfo = parseChapterFromUrl(url)
  
  // Auto-detect website pattern when URL changes
  React.useEffect(() => {
    if (url) {
      const detectedPattern = detectWebsitePattern(url)
      if (detectedPattern && !selectedWebsitePattern) {
        setSelectedWebsitePattern(detectedPattern)
      }
    }
  }, [url, selectedWebsitePattern])

  // Handle pattern selection
  const handlePatternSelect = (pattern: WebsitePattern) => {
    setSelectedWebsitePattern(pattern)
    setIsPatternDropdownOpen(false)
    
    if (pattern.id === 'custom') {
      setShowAdvancedPatterns(true)
    } else if (pattern.id === 'auto-detect') {
      // Try to auto-detect the pattern from current URL
      if (url) {
        const detectedPattern = autoDetectUrlPattern(url)
        if (detectedPattern) {
          setSelectedWebsitePattern(detectedPattern)
          setShowAdvancedPatterns(false)
          // Auto-apply the detected pattern
          const envFormat = convertToEnvFormat(detectedPattern)
          onCustomUrlPatternsChange(envFormat)
        } else {
          // If auto-detection fails, show advanced patterns
          setShowAdvancedPatterns(true)
        }
      } else {
        setShowAdvancedPatterns(true)
      }
    } else {
      setShowAdvancedPatterns(false)
      // Auto-apply the pattern
      const envFormat = convertToEnvFormat(pattern)
      onCustomUrlPatternsChange(envFormat)
    }
  }

  // Handle apply pattern button
  const handleApplySelectedPattern = () => {
    if (selectedWebsitePattern && selectedWebsitePattern.id !== 'custom') {
      const envFormat = convertToEnvFormat(selectedWebsitePattern)
      onCustomUrlPatternsChange(envFormat)
      onUrlPatternsApply()
    }
  }

  if (!showConfiguration) {
    return null
  }

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
        fetchInterval={fetchInterval}
        onFetchIntervalChange={onFetchIntervalChange}
        showScrollButtons={showScrollButtons}
        onShowScrollButtonsChange={onShowScrollButtonsChange}
        validateImages={validateImages}
        onValidateImagesChange={onValidateImagesChange}
        backgroundPreloading={backgroundPreloading}
        onBackgroundPreloadingChange={onBackgroundPreloadingChange}
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
            <Tooltip open={tooltipStates.urlPatterns} onOpenChange={(_open) => onTooltipToggle('urlPatterns')}>
              <TooltipTrigger asChild>
                <button className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="URL patterns info">
                  <Info className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="text-xs max-w-64">
                  <div className="font-medium mb-1">Website URL Patterns</div>
                  <div>Choose from predefined patterns for popular manga/comic sites, or create custom patterns for any website. No more .env editing required!</div>
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
          <div className="space-y-4">
            {/* Website Pattern Dropdown */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Select Website Pattern</label>
              <div className="relative">
                <button
                  onClick={() => setIsPatternDropdownOpen(!isPatternDropdownOpen)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-input border border-border rounded-md text-foreground hover:bg-accent/20 transition-colors"
                  disabled={isLoading}
                >
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {selectedWebsitePattern 
                        ? `${selectedWebsitePattern.name} (${selectedWebsitePattern.domain || 'Custom'})`
                        : 'Choose a website pattern...'
                      }
                    </span>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isPatternDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isPatternDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
                    {PREDEFINED_WEBSITE_PATTERNS.map((pattern) => (
                      <button
                        key={pattern.id}
                        onClick={() => handlePatternSelect(pattern)}
                        className="w-full flex items-start space-x-3 px-3 py-2.5 hover:bg-accent/50 transition-colors text-left"
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {pattern.id === 'custom' ? (
                            <Settings className="h-4 w-4 text-muted-foreground" />
                          ) : pattern.id === 'auto-detect' ? (
                            <Search className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Globe className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-foreground">{pattern.name}</div>
                          {pattern.domain && (
                            <div className="text-xs text-muted-foreground">{pattern.domain}</div>
                          )}
                          <div className="text-xs text-muted-foreground mt-0.5">{pattern.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Pattern Preview */}
            {selectedWebsitePattern && selectedWebsitePattern.id !== 'custom' && (
              <div className="p-3 bg-accent/10 border border-accent/20 rounded-md">
                <div className="text-sm font-medium text-foreground mb-2">Pattern Preview</div>
                <div className="space-y-1.5">
                  <div className="text-xs">
                    <span className="text-muted-foreground">URL Pattern:</span>
                    <div className="font-mono text-primary bg-background/50 px-2 py-1 rounded mt-1">{selectedWebsitePattern.urlPattern}</div>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Example:</span>
                    <div className="text-foreground mt-1">{selectedWebsitePattern.example}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleApplySelectedPattern}
                disabled={isLoading || !selectedWebsitePattern || selectedWebsitePattern.id === 'custom' || selectedWebsitePattern.id === 'auto-detect'}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Zap className="h-4 w-4" />
                <span>Apply Pattern</span>
              </button>
              <button
                onClick={() => setShowAdvancedPatterns(!showAdvancedPatterns)}
                className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
              >
                {showAdvancedPatterns ? 'Hide Advanced' : 'Show Advanced'}
              </button>
            </div>

            {/* Advanced Pattern Configuration */}
            {(showAdvancedPatterns || selectedWebsitePattern?.id === 'custom') && (
              <div className="space-y-3 p-3 bg-muted/10 border border-muted/20 rounded-md">
                <div className="text-sm font-medium text-foreground">Advanced Configuration</div>
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Pattern Configuration (.env format)</label>
                  <textarea
                    value={customUrlPatterns}
                    onChange={(e) => onCustomUrlPatternsChange(e.target.value)}
                    placeholder={`# Example URL patterns:
# manga-site.com
VITE_URL_MANGA=manga-site.com
VITE_CONFIG_MANGA=https://manga-site.com/manga/{title}/chapter-{chapter}
VITE_CH_NEXT_MANGA={n+1}

# comic-reader.net  
VITE_URL_COMIC=comic-reader.net
VITE_CONFIG_COMIC=https://comic-reader.net/comics/{title}/ch-{chapter:03d}
VITE_CH_NEXT_COMIC={n+1}`}
                    className="w-full h-32 px-3 py-2 text-xs bg-input border border-border rounded-md text-foreground font-mono resize-none"
                    disabled={isLoading}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={onUrlPatternsApply}
                    disabled={isLoading || !customUrlPatterns.trim()}
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Apply Advanced Patterns
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
        )}
      </div>
      
      {/* Image Filtering Section */}
      <ImageFiltering
        imageFilters={imageFilters}
        newFilter={newFilter}
        showImageFilters={showImageFilters}
        isLoading={isLoading}
        tooltipOpen={tooltipStates.imageFiltering}
        onTooltipOpenChange={(_open) => onTooltipToggle('imageFiltering')}
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