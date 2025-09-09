import React from 'react'
import { Info, Filter } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

interface ScrapingConfigurationProps {
  // Scraping method
  scrapingMethod: 'smart' | 'fast'
  onScrapingMethodChange: (method: 'smart' | 'fast') => void
  
  // Chapter settings
  consecutiveMissThreshold: number
  onConsecutiveMissThresholdChange: (value: number) => void
  chapterCount: number
  onChapterCountChange: (value: number) => void
  
  // Request timing
  fetchInterval: number
  onFetchIntervalChange: (value: number) => void
  
  // Interface options
  showScrollButtons: boolean
  onShowScrollButtonsChange: (value: boolean) => void
  
  // Validation
  validateImages: boolean
  onValidateImagesChange: (value: boolean) => void
  
  // Background preloading
  backgroundPreloading: boolean
  onBackgroundPreloadingChange: (value: boolean) => void
  
  // File types
  fileTypes: string[]
  availableFileTypes: string[]
  onFileTypeToggle: (type: string) => void
  
  // Loading state
  isLoading: boolean
  
  // Tooltip states
  tooltipStates: {
    smartInfo: boolean
    fastInfo: boolean
    missInfo: boolean
    chapterInfo: boolean
    validateInfo: boolean
    fetchIntervalInfo: boolean
    preloadingInfo: boolean
  }
  onTooltipToggle: (key: string) => void
}

const ScrapingConfiguration: React.FC<ScrapingConfigurationProps> = ({
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
  backgroundPreloading,
  onBackgroundPreloadingChange,
  fileTypes,
  availableFileTypes,
  onFileTypeToggle,
  isLoading,
  tooltipStates,
  onTooltipToggle
}) => {
  return (
    <div className="space-y-6">
      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Core Settings */}
        <div className="space-y-4">
          {/* Scraping Method */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-3">Scraping Method</h4>
            <div className="flex gap-3">
              <div className={`relative flex-1 rounded-lg border-2 transition-all duration-200 ${
                scrapingMethod === 'smart' 
                  ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                  : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-accent/20'
              }`}>
                <button
                  onClick={() => onScrapingMethodChange('smart')}
                  className="w-full px-3 py-2.5 rounded-lg"
                  disabled={isLoading}
                  aria-label="Smart scraping method"
                >
                  <div className="text-center">
                    <div className="font-semibold text-sm">Smart</div>
                    <div className="text-xs mt-0.5 opacity-80">Thorough</div>
                  </div>
                </button>
                <Tooltip open={tooltipStates.smartInfo} onOpenChange={(_open) => onTooltipToggle('smartInfo')}>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => onTooltipToggle('smartInfo')} 
                      className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                        scrapingMethod === 'smart' ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                      aria-label="Smart method info"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Runs thorough DOM + JS detection to find all images on the page.</TooltipContent>
                </Tooltip>
              </div>

              <div className={`relative flex-1 rounded-lg border-2 transition-all duration-200 ${
                scrapingMethod === 'fast' 
                  ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                  : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-accent/20'
              }`}>
                <button
                  onClick={() => onScrapingMethodChange('fast')}
                  className="w-full px-3 py-2.5 rounded-lg"
                  disabled={isLoading}
                  aria-label="Fast scraping method"
                >
                  <div className="text-center">
                    <div className="font-semibold text-sm">Fast</div>
                    <div className="text-xs mt-0.5 opacity-80">Sequential</div>
                  </div>
                </button>
                <Tooltip open={tooltipStates.fastInfo} onOpenChange={(_open) => onTooltipToggle('fastInfo')}>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => onTooltipToggle('fastInfo')} 
                      className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center ${
                        scrapingMethod === 'fast' ? 'bg-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/30' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      }`}
                      aria-label="Fast method info"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Assumes sequential filenames and generates image URLs quickly without page analysis.</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Chapter Settings */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-3">Chapter Settings</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Miss Threshold</label>
                <div className="relative">
                  <select
                    value={consecutiveMissThreshold}
                    onChange={(e) => onConsecutiveMissThresholdChange(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 text-sm bg-input border border-border rounded-md text-foreground appearance-none"
                    disabled={isLoading}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                  <Tooltip open={tooltipStates.missInfo} onOpenChange={(_open) => onTooltipToggle('missInfo')}>
                    <TooltipTrigger asChild>
                      <button onClick={() => onTooltipToggle('missInfo')} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Miss info">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Number of consecutive missed requests before the scraper stops trying sequential generation.</TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Chapter Count</label>
                <div className="relative">
                  <select
                    value={chapterCount}
                    onChange={(e) => onChapterCountChange(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 text-sm bg-input border border-border rounded-md text-foreground appearance-none"
                    disabled={isLoading}
                  >
                    {/* Generate options 1-20 individually */}
                    {Array.from({length: 20}, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                    {/* Generate options 25, 30, 35... up to 200 in increments of 5 */}
                    {Array.from({length: 36}, (_, i) => (i + 5) * 5).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <Tooltip open={tooltipStates.chapterInfo} onOpenChange={(_open) => onTooltipToggle('chapterInfo')}>
                    <TooltipTrigger asChild>
                      <button onClick={() => onTooltipToggle('chapterInfo')} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Chapters info">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Number of chapters to fetch in a single action when navigating.</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Fetch Interval Settings */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-3">Request Timing</h4>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Fetch Interval (seconds)</label>
              <div className="relative">
                <select
                  value={fetchInterval}
                  onChange={(e) => onFetchIntervalChange(Number(e.target.value))}
                  className="w-full pl-3 pr-8 py-2 text-sm bg-input border border-border rounded-md text-foreground appearance-none"
                  disabled={isLoading}
                >
                  {/* Generate interval options based on chapter count */}
                  {chapterCount >= 15 
                    ? [30, 45, 60, 75, 90, 120, 150, 180, 200].map(seconds => (
                        <option key={seconds} value={seconds}>{seconds}s</option>
                      ))
                    : [15, 20, 25, 30, 45, 60, 75, 90, 120, 150, 180, 200].map(seconds => (
                        <option key={seconds} value={seconds}>{seconds}s</option>
                      ))
                  }
                </select>
                <Tooltip open={tooltipStates.fetchIntervalInfo} onOpenChange={(_open) => onTooltipToggle('fetchIntervalInfo')}>
                  <TooltipTrigger asChild>
                    <button onClick={() => onTooltipToggle('fetchIntervalInfo')} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Fetch interval info">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {chapterCount >= 15 
                      ? "Minimum 30 seconds required for 15+ chapters to avoid overwhelming servers."
                      : "Time between image fetch requests. Minimum 15 seconds, can be reduced for smaller chapter counts."
                    }
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Interface & Validation */}
        <div className="space-y-4">
          {/* Interface Options */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-3">Interface Options</h4>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 text-sm cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={showScrollButtons} 
                    onChange={(e) => onShowScrollButtonsChange(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${
                    showScrollButtons 
                      ? 'bg-primary border-primary' 
                      : 'bg-background border-border hover:border-primary/50'
                  }`}>
                    {showScrollButtons && (
                      <svg className="w-3 h-3 text-primary-foreground absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-foreground">Show preview scroll buttons</span>
              </label>
            </div>
          </div>

          {/* Performance Options */}
          <div className="p-4 bg-secondary/10 border border-secondary/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-3">
              <h4 className="text-sm font-medium text-foreground">Performance Settings</h4>
              <Tooltip>
                <TooltipTrigger>
                  <Info 
                    className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" 
                    onClick={() => onTooltipToggle('preloadingInfo')}
                  />
                </TooltipTrigger>
                {tooltipStates.preloadingInfo && (
                  <TooltipContent side="top">
                    <p className="text-sm">Background preloading downloads next chapter images while you read, for faster navigation</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </div>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 text-sm cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    checked={backgroundPreloading} 
                    onChange={(e) => onBackgroundPreloadingChange(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${
                    backgroundPreloading 
                      ? 'bg-primary border-primary' 
                      : 'bg-background border-border hover:border-primary/50'
                  }`}>
                    {backgroundPreloading && (
                      <svg className="w-3 h-3 text-primary-foreground absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-foreground">Background preload next chapter</span>
              </label>
            </div>
          </div>

          {/* Validation Options */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-3">Validation Settings</h4>
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="validateImages"
                checked={validateImages}
                onChange={(e) => onValidateImagesChange(e.target.checked)}
                className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary focus:ring-2"
                disabled={isLoading}
              />
              <label htmlFor="validateImages" className="text-sm text-foreground cursor-pointer flex-1">
                Validate images before adding
              </label>
              
              <Tooltip open={tooltipStates.validateInfo} onOpenChange={(_open) => onTooltipToggle('validateInfo')}>
                <TooltipTrigger asChild>
                  <button onClick={() => onTooltipToggle('validateInfo')} className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Validation info">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <div className="text-xs max-w-48">
                    <div className="font-medium mb-1">Image Validation</div>
                    <div>When enabled, checks if each image exists before adding (more requests). When disabled, adds all discovered images directly (faster, fewer requests).</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* File Types Section */}
          <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <h4 className="text-sm font-medium text-foreground">File Types ({fileTypes.length} selected)</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableFileTypes.map(type => (
                <button
                  key={type}
                  onClick={() => onFileTypeToggle(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    fileTypes.includes(type)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  disabled={isLoading}
                >
                  .{type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ScrapingConfiguration