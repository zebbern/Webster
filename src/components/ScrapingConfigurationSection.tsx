import React, { useState } from 'react'
import { Settings, Filter, Info, Globe, Zap, ChevronDown, Search } from 'lucide-react'
import ScrapingConfiguration from './ScrapingConfiguration'
import ImageFiltering from './ImageFiltering'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { parseChapterFromUrl } from '../utils/urlNavigation'
import { FILE_EXTENSIONS } from '../constants'
import { PREDEFINED_WEBSITE_PATTERNS, WebsitePattern, convertToEnvFormat, detectWebsitePattern, autoDetectUrlPattern } from '../constants/websitePatterns'
import { extractImageUrls } from '../utils/advancedImageScraper'

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
  const [selectedWebsitePattern, setSelectedWebsitePattern] = useState<WebsitePattern | null>(null)
  const [isPatternDropdownOpen, setIsPatternDropdownOpen] = useState(false)
  const [showAdvancedPatterns, setShowAdvancedPatterns] = useState(false)
  const [isAutoDetecting, setIsAutoDetecting] = useState(false)
  const [discoveredUrls, setDiscoveredUrls] = useState<string[]>([])
  const [showUrlSelection, setShowUrlSelection] = useState(false)

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
      // Start interactive auto-detection workflow
      handleInteractiveAutoDetect()
    } else {
      setShowAdvancedPatterns(false)
      // Auto-apply the pattern
      const envFormat = convertToEnvFormat(pattern)
      onCustomUrlPatternsChange(envFormat)
    }
  }

  // Handle interactive auto-detection
  const handleInteractiveAutoDetect = async () => {
    if (!url) return

    setIsAutoDetecting(true)
    setShowUrlSelection(false)

    try {
      // Fetch the HTML content
      const response = await fetch(url)
      const html = await response.text()
      
      // Extract all image URLs from HTML
      const discoveredImageUrls = extractImageUrls(html, [], url, html, false)
      
      // Filter out base64 images and group by domain/pattern
      const validUrls = discoveredImageUrls
        .filter(imgUrl => imgUrl.startsWith('http') && !imgUrl.startsWith('data:'))
        .slice(0, 20) // Limit to first 20 for UI performance
        
      if (validUrls.length > 0) {
        setDiscoveredUrls(validUrls)
        setShowUrlSelection(true)
      } else {
        // No URLs found, fallback to advanced patterns
        setShowAdvancedPatterns(true)
      }
    } catch (error) {
      console.error('Auto-detection failed:', error)
      setShowAdvancedPatterns(true)
    } finally {
      setIsAutoDetecting(false)
    }
  }

  // Handle URL selection from discovered URLs
  const handleUrlSelection = (selectedUrl: string) => {
    try {
      // Create pattern from selected URL
      const urlObj = new URL(selectedUrl)
      const domain = urlObj.hostname
      
      // Try to find number pattern in the URL
      const numberMatch = selectedUrl.match(/(\d+)(\.[^\/]*)?$/)
      if (numberMatch) {
        const number = numberMatch[1]
        const extension = numberMatch[2] || ''
        const basePattern = selectedUrl.replace(number + extension, '{chapter:' + '0'.repeat(number.length) + 'd}' + extension)
        
        const detectedPattern: WebsitePattern = {
          id: 'user-selected',
          name: `Pattern from ${domain}`,
          domain: domain,
          description: `User-selected pattern from discovered URLs`,
          urlPattern: basePattern,
          chapterConfig: '{n}',
          example: selectedUrl
        }
        
        setSelectedWebsitePattern(detectedPattern)
        setShowUrlSelection(false)
        setShowAdvancedPatterns(false)
        
        // Auto-apply the pattern
        const envFormat = convertToEnvFormat(detectedPattern)
        onCustomUrlPatternsChange(envFormat)
      }
    } catch (error) {
      console.error('Failed to create pattern from selected URL:', error)
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

            {/* Auto-Detect Loading */}
            {isAutoDetecting && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  <div>
                    <div className="text-sm font-medium text-blue-900 dark:text-blue-100">Analyzing HTML content...</div>
                    <div className="text-xs text-blue-700 dark:text-blue-300">Discovering image URLs from the page</div>
                  </div>
                </div>
              </div>
            )}

            {/* URL Selection Interface */}
            {showUrlSelection && discoveredUrls.length > 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                <div className="text-sm font-medium text-green-900 dark:text-green-100 mb-3">
                  Found {discoveredUrls.length} image URLs! Choose the pattern you want to use:
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {discoveredUrls.map((discoveredUrl, index) => {
                    const urlObj = new URL(discoveredUrl)
                    const path = urlObj.pathname
                    const filename = path.split('/').pop() || ''
                    
                    return (
                      <button
                        key={index}
                        onClick={() => handleUrlSelection(discoveredUrl)}
                        className="w-full p-3 text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {filename}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                              {urlObj.hostname}{path}
                            </div>
                          </div>
                          <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-1 rounded">
                              Use Pattern
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                  <div className="text-xs text-green-700 dark:text-green-300">
                    💡 Select an image URL that represents the pattern you want (e.g., "001.webp" for sequential numbering)
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