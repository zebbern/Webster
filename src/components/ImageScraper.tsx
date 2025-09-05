import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search, AlertCircle, CheckCircle, Loader2, ChevronLeft, ChevronRight, Filter, Info, Settings } from 'lucide-react'
import { toast } from 'sonner'
import ImageGallery from './ImageGallery'
import ProgressIndicator from './ProgressIndicator'
import ThemeToggle from './ThemeToggle'
import ChapterNavigation from './ChapterNavigation'
import ScrapingConfiguration from './ScrapingConfiguration'
import ImageFiltering from './ImageFiltering'
import { scrapeImages, ScrapedImage, ScrapeProgress, clearRequestCache } from '../utils/advancedImageScraper'
import { parseChapterFromUrl } from '../utils/urlNavigation'
import { urlPatternManager } from '../utils/urlPatterns'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { useImageScrapingState } from '../hooks/useImageScrapingState'
import { TIMING, DEFAULTS, REGEX_PATTERNS, ERROR_MESSAGES, FILE_EXTENSIONS } from '../constants'

const ImageScraper: React.FC = () => {
  const [url, setUrl] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const upArrowClickTimeoutRef = useRef<number | null>(null)
  
  // Use the consolidated state management hook
  const {
    scraping,
    navigation,
    configuration,
    ui,
    filters,
    scrapingActions,
    navigationActions,
    configurationActions,
    uiActions,
    filterActions
  } = useImageScrapingState()

  // Navigation lock with minimal fullscreen interference
  useEffect(() => {
    if (navigation.isNavigating) {
      // Only modify body, not html element to avoid fullscreen conflicts
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      console.log('Navigation lock: Body scroll blocked, overlay active')
    } else {
      // Restore body scroll
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      console.log('Navigation lock: Body scroll restored, overlay removed')
    }

    return () => {
      // Cleanup on unmount
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [navigation.isNavigating])

  // Safety mechanism: reset stuck states after component mount
  useEffect(() => {
    const resetStuckStates = () => {
      if (!scraping.isLoading && navigation.isNavigating) {
        console.warn('Detected stuck navigation state, resetting...')
        navigationActions.setNavigating(false)
      }
      if (scraping.isImageStateResetting) {
        console.warn('Detected stuck image reset state, resetting...')
        // This will be handled internally by the hook
      }
    }
    
    // Check for stuck states every 30 seconds
    const interval = setInterval(resetStuckStates, TIMING.SAFETY_CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [scraping.isLoading, navigation.isNavigating, scraping.isImageStateResetting, navigationActions])


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (upArrowClickTimeoutRef.current) {
        window.clearTimeout(upArrowClickTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])



  
  
  


  // Consolidated tooltip toggle handler
  const handleTooltipToggle = useCallback((key: string) => {
    uiActions.toggleTooltip(key)
  }, [uiActions])

  const handleFileTypeToggle = (type: string) => {
    configurationActions.toggleFileType(type)
  }

  const handleChapterCountChange = (newChapterCount: number) => {
    configurationActions.updateChapterCount(newChapterCount)
  }

  const handleFetchIntervalChange = (newInterval: number) => {
    configurationActions.updateFetchInterval(newInterval)
  }

  const generateChapterUrl = (baseUrl: string, chapterNumber: number) => {
    try {
      const urlObj = new URL(baseUrl)
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0)
      const chapterInfo = parseChapterFromUrl(baseUrl)
      
      if (!chapterInfo.hasChapter) return baseUrl
      
      // Find and replace the chapter segment
      for (let i = pathSegments.length - 1; i >= 0; i--) {
        const segment = pathSegments[i]
        
        if (segment === chapterInfo.chapterSegment) {
          // Determine the new segment format based on the original
          const chapterMatch = segment.match(/^(chapter|ch|episode|ep|part|p)[-_]?(\d+)$/i)
          if (chapterMatch) {
            const prefix = chapterMatch[1]
            const separator = segment.includes('-') ? '-' : (segment.includes('_') ? '_' : '')
            pathSegments[i] = `${prefix}${separator}${chapterNumber}`
          } else if (segment.match(/^\d+$/)) {
            pathSegments[i] = chapterNumber.toString()
          }
          break
        }
      }
      
      // Reconstruct the URL
      urlObj.pathname = '/' + pathSegments.join('/') + (baseUrl.endsWith('/') ? '/' : '')
      return urlObj.toString()
    } catch (error) {
      return baseUrl
    }
  }

  // Unified chapter URL update function that works with custom patterns
  const updateChapterUrl = (targetChapterNumber: number, immediate: boolean = true) => {
    const chapterInfo = parseChapterFromUrl(url)
    if (!chapterInfo.hasChapter) return url
    
    // Validate chapter number
    if (targetChapterNumber < 1) {
      console.warn('Invalid chapter number:', targetChapterNumber)
      return url
    }
    
    try {
      let newUrl: string | null = null
      
      // First try using URL pattern manager for custom patterns
      newUrl = urlPatternManager.generateChapterUrl(url, targetChapterNumber)
      
      // If pattern manager didn't generate a URL, fall back to default method
      if (!newUrl) {
        newUrl = generateChapterUrl(url, targetChapterNumber)
      }
      
      if (immediate && newUrl) {
        setUrl(newUrl)
        console.log(`Updated URL to chapter ${targetChapterNumber}:`, newUrl)
      }
      
      return newUrl || url
    } catch (error) {
      console.error('Error updating chapter URL:', error)
      return url
    }
  }

  const handleUrlPatternsApply = () => {
    try {
      if (filters.customUrlPatterns.trim()) {
        // Import custom patterns into the URL pattern manager
        urlPatternManager.importFromEnvFormat(filters.customUrlPatterns)
        toast.success('URL patterns imported successfully')
      } else {
        toast.info('No patterns to import')
      }
    } catch (error: any) {
      toast.error(`Failed to import URL patterns: ${error.message}`)
    }
  }

  const handleUrlPatternsExport = () => {
    try {
      const exported = urlPatternManager.exportToEnvFormat()
      filterActions.setCustomUrlPatterns(exported)
      if (exported) {
        toast.success('Current patterns exported to editor')
      } else {
        toast.info('No patterns configured to export')
      }
    } catch (error: any) {
      toast.error(`Failed to export URL patterns: ${error.message}`)
    }
  }

  // Image filter management functions
  const handleAddFilter = () => {
    if (filters.newFilter.trim() && !filters.imageFilters.includes(filters.newFilter.trim().toLowerCase())) {
      const filter = filters.newFilter.trim().toLowerCase()
      filterActions.addFilter(filter)
      filterActions.setNewFilter('')
      toast.success(`Added filter: "${filter}"`)
    }
  }

  const handleRemoveFilter = (filterToRemove: string) => {
    filterActions.removeFilter(filterToRemove)
    toast.info(`Removed filter: "${filterToRemove}"`)
  }

  const handleClearAllFilters = () => {
    filterActions.clearAllFilters()
    toast.info('Cleared all image filters')
  }


  const handleScrape = async () => {
    const chapterInfo = parseChapterFromUrl(url)
    if (chapterInfo.hasChapter && configuration.chapterCount > 1) {
      // Calculate target chapter range for URL update
      const startChapter = chapterInfo.chapterNumber
      const endChapter = startChapter + configuration.chapterCount - 1
      
      // Update URL immediately to final position for better UX
      updateChapterUrl(endChapter, true)
      
      // Start scraping from original URL
      await handleScrapeWithUrl(chapterInfo.chapterNumber === startChapter ? url : generateChapterUrl(url, startChapter))
    } else {
      await handleScrapeWithUrl()
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (upArrowClickTimeoutRef.current) {
      window.clearTimeout(upArrowClickTimeoutRef.current)
      upArrowClickTimeoutRef.current = null
    }
  }

  const generateSequentialScrapedImages = (basePath: string, extension: string, pad: number, count = DEFAULTS.SEQUENTIAL_MAX_IMAGES) => {
    const out: ScrapedImage[] = []
    for (let i = 1; i <= count; i++) {
      const padded = i.toString().padStart(pad, '0')
      const url = `${basePath}${padded}.${extension}`
      out.push({ url, type: extension, source: 'static', alt: `Image ${padded}` })
    }
    return out
  }

  const detectSequentialPatternFromUrls = (urls: string[]) => {
    const regex = /^(.*\/)([0-9]{2,4})\.(jpg|jpeg|png|gif|webp)$/i
    const map = new Map<string, Set<number>>()
    const padMap = new Map<string, number>()

    for (const u of urls) {
      const m = u.match(regex)
      if (m) {
        const base = m[1]
        const numStr = m[2]
        const ext = m[3]
        const key = base + '||' + ext
        const set = map.get(key) || new Set<number>()
        set.add(parseInt(numStr, 10))
        map.set(key, set)
        padMap.set(key, Math.max(padMap.get(key) || 0, numStr.length))
      }
    }

    for (const [key, set] of map.entries()) {
      const nums = Array.from(set).sort((a, b) => a - b)
      for (let i = 0; i < nums.length - 1; i++) {
        if (nums[i + 1] === nums[i] + 1) {
          const [base, ext] = key.split('||')
          const pad = padMap.get(key) || 3
          return { basePath: base, extension: ext, pad }
        }
      }
    }

    return null
  }


  // Function to immediately start navigation lock (for auto navigation)
  const handleStartNavigation = useCallback(() => {
    navigationActions.setNavigating(true)
    
    // Extended lock for auto navigation to allow for proper chapter processing
    // Will be cleared either by timeout or when scraping completes
    setTimeout(() => {
      navigationActions.setNavigating(false)
    }, TIMING.EXTENDED_NAVIGATION_LOCK)
  }, [navigationActions])


  // Progress handler that supports live insertion of images reported by the scraper with race condition protection
  const handleProgress = useCallback((p: ScrapeProgress) => {
    console.log('Progress update:', p.stage, `${p.processed}/${p.total}`)
    scrapingActions.handleProgress(p)
    
    // Handle chapter results and show failure notifications
    if (p.chapterResults && configuration.chapterCount > 1) {
      const latestResult = p.chapterResults[p.chapterResults.length - 1]
      if (latestResult && !latestResult.success && latestResult.error !== 'Aborted') {
        toast.error(`Chapter ${latestResult.chapterNumber} failed: ${latestResult.error}`)
      }
    }
    
    if (p.image && !scraping.isImageStateResetting) {
      console.log(`Adding image: ${p.image.url}`)
      scrapingActions.handleNewImage(p.image)
    } else if (p.image && scraping.isImageStateResetting) {
      console.log('Image blocked by reset state:', p.image.url)
    }
  }, [configuration.chapterCount, scraping.isImageStateResetting, scrapingActions])


  const handleScrapeWithUrl = async (targetUrl?: string) => {
    const scrapeUrl = targetUrl || url
    
    if (!scrapeUrl.trim()) {
      scrapingActions.setError(ERROR_MESSAGES.INVALID_URL)
      toast.error(ERROR_MESSAGES.INVALID_URL)
      return
    }

    if (configuration.fileTypes.length === 0) {
      scrapingActions.setError(ERROR_MESSAGES.NO_FILE_TYPES)
      toast.error(ERROR_MESSAGES.NO_FILE_TYPES)
      return
    }

    // Only set navigation lock if not already set by navigation (e.g., auto next chapter)
    if (!navigation.isNavigating) {
      navigationActions.setNavigating(true)
      
      // Clear navigation lock after timeout to allow for multi-chapter processing
      setTimeout(() => {
        navigationActions.setNavigating(false)
      }, TIMING.NAVIGATION_LOCK_TIMEOUT)
    }

    scrapingActions.setIsLoading(true)
    scrapingActions.setError(null)
    
    // Reset state using the hook's resetState method
    await scrapingActions.resetState()
    
    // Clear request cache to prevent stale requests from affecting new scraping session
    clearRequestCache()

    abortControllerRef.current = new AbortController()

    try {
      toast.info(`Starting to scrape images from ${new URL(scrapeUrl).hostname}...`)

      const options: any = {
        onProgress: handleProgress,
        onNewImage: scrapingActions.handleNewImage,
        signal: abortControllerRef.current.signal,
        consecutiveMissThreshold: configuration.consecutiveMissThreshold,
        chapterCount: configuration.chapterCount,
        validateImages: configuration.validateImages,
        fetchInterval: configuration.fetchInterval * 1000, // Convert seconds to milliseconds
        imageFilter: filterActions.shouldFilterImage // Pass filter function to scraper
      }

      if (configuration.scrapingMethod === 'fast') {
        // prefer sequence-only fast generation
        options.preferSequenceOnly = true
        options.keepAliveMs = 0
        options.consecutiveMissThreshold = configuration.consecutiveMissThreshold
      }

      console.log('Scraping with file types:', configuration.fileTypes)
      const scrapedImages = await scrapeImages(scrapeUrl, configuration.fileTypes, options)

      // Merge returned images with any live-inserted images ensuring uniqueness
      scrapedImages.forEach(image => scrapingActions.handleNewImage(image))

      // Save last page URL for chapter navigation
      navigationActions.setLastPageUrl(scrapeUrl)

      // Detect sequential pattern from returned images and save for quick generation
      const seq = detectSequentialPatternFromUrls(scrapedImages.map(s => s.url))
      if (seq) {
        let normalized = seq.basePath
        if (!normalized.endsWith('/')) normalized = normalized + '/'
        scrapingActions.setSequentialPattern({ basePath: normalized, extension: seq.extension, pad: seq.pad })
      }
      
      if ((scrapedImages && scrapedImages.length) || scraping.images.length > 0) {
        // Show chapter results summary for multi-chapter scraping
        if (configuration.chapterCount > 1 && scraping.progress?.chapterResults) {
          const successful = scraping.progress.chapterResults.filter(r => r.success)
          const failed = scraping.progress.chapterResults.filter(r => !r.success)
          const totalImages = successful.reduce((sum, r) => sum + r.imageCount, 0)
          
          if (failed.length > 0) {
            toast.warning(`Multi-chapter scraping completed with issues`, {
              description: `Found ${totalImages} images across ${successful.length}/${configuration.chapterCount} chapters. Failed chapters: ${failed.map(r => r.chapterNumber).join(', ')}`
            })
          } else {
            toast.success(`Multi-chapter scraping completed successfully`, {
              description: `Found ${totalImages} images across all ${configuration.chapterCount} chapters`
            })
          }
        }
      } else {
        toast.warning('No images found', {
          description: 'The site may be protected or have no matching images'
        })
      }
    } catch (err: any) {
    if (err.message === 'Aborted') {
      // do not show toast on abort
    } else {
      let errorMessage = err.message || ERROR_MESSAGES.SCRAPING_FAILED
      let toastDescription = errorMessage
      
      // Handle CORS-specific errors with helpful messages
      if (errorMessage.includes('proxy services failed') || errorMessage.includes('CORS')) {
        errorMessage = ERROR_MESSAGES.CORS_ERROR
        toastDescription = 'The website blocks direct access. Try a different site or check if the URL is correct.'
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        errorMessage = ERROR_MESSAGES.NETWORK_ERROR
        toastDescription = 'Check your internet connection and verify the URL is correct.'
      }
      
      scrapingActions.setError(errorMessage)
      toast.error('Scraping failed', {
        description: toastDescription
      })
    }
    } finally {
    scrapingActions.setIsLoading(false)
    scrapingActions.handleProgress(null)
    // Clear navigation lock when scraping completes (success or failure)
    navigationActions.setNavigating(false)
    }
  }

  // Remove an image URL from the list (called when browser reports 1st-load 404)
  const handleRemoveImageOnError = (urlToRemove: string) => {
    scrapingActions.removeImageOnError(urlToRemove)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <span className="text-2xl">🕸️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Webster</h1>
                <p className="text-muted-foreground">No ads, no limits, no nonsense start reading adfree today!</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <a href="https://github.com/zebbern" target="_blank" rel="noopener noreferrer" title="zebbern on GitHub" className="rounded-full overflow-hidden w-10 h-10 border border-border hover:shadow-md">
                <img src="/zebbern.png" alt="zebbern" className="w-full h-full object-cover" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
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
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/chapter-0"
                  className="w-full pl-10 pr-4 py-3 bg-input border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground"
                  disabled={scraping.isLoading}
                />
              </div>

              {/* Chapter Navigation */}
              <ChapterNavigation
                chapterInfo={parseChapterFromUrl(url)}
                chapterCount={configuration.chapterCount}
                tooltipOpen={ui.tooltipStates.navInfo}
                onTooltipOpenChange={(open) => handleTooltipToggle('navInfo')}
              />

              {/* Start/Stop Button with Configuration Toggle */}
              <div className="flex justify-center items-center gap-3">
                {!scraping.isLoading ? (
                  <button
                    onClick={handleScrape}
                    className="px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center space-x-2 text-base"
                    aria-label="Start Scraping"
                  >
                    <Search className="h-5 w-5" />
                    <span>Start Scraping</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="px-8 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium flex items-center space-x-2 text-base"
                  >
                    <span>Stop Scraping</span>
                  </button>
                )}
                
                {/* Configuration Toggle Button */}
                <button
                  onClick={uiActions.toggleConfiguration}
                  className={`p-3 rounded-lg transition-colors font-medium flex items-center justify-center ${
                    ui.showConfiguration 
                      ? 'bg-primary/80 text-primary-foreground hover:bg-primary' 
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  title={ui.showConfiguration ? 'Hide Configuration' : 'Show Configuration'}
                  aria-label="Toggle Configuration"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Options */}
          {ui.showConfiguration && (
          <div className="mb-6 bg-accent/5 border border-accent/20 rounded-xl p-6 space-y-6">
            {/* Configuration Header */}
            <div className="flex items-center gap-2 pb-2 border-b border-accent/20">
              <Settings className="h-5 w-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-foreground">Configuration</h3>
            </div>
            
            {/* Current Settings Display */}
            {(() => {
              const chapterInfo = parseChapterFromUrl(url)
              return chapterInfo.hasChapter ? (
                <div className="mb-6 p-3 bg-accent/10 border border-accent/20 rounded-lg text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm text-foreground">
                    <span>📖</span>
                    <span>Chapter {chapterInfo.chapterNumber} detected - Will fetch {configuration.chapterCount} chapter(s) per action</span>
                  </div>
                </div>
              ) : null
            })()}
            
            {/* Scraping Configuration Component */}
            <ScrapingConfiguration
              scrapingMethod={configuration.scrapingMethod}
              onScrapingMethodChange={configurationActions.updateScrapingMethod}
              consecutiveMissThreshold={configuration.consecutiveMissThreshold}
              onConsecutiveMissThresholdChange={configurationActions.updateConsecutiveMissThreshold}
              chapterCount={configuration.chapterCount}
              onChapterCountChange={handleChapterCountChange}
              autoNextChapter={configuration.autoNextChapter}
              onAutoNextChapterChange={configurationActions.updateAutoNextChapter}
              fetchInterval={configuration.fetchInterval}
              onFetchIntervalChange={handleFetchIntervalChange}
              showScrollButtons={configuration.showScrollButtons}
              onShowScrollButtonsChange={configurationActions.updateShowScrollButtons}
              validateImages={configuration.validateImages}
              onValidateImagesChange={configurationActions.updateValidateImages}
              fileTypes={configuration.fileTypes}
              availableFileTypes={FILE_EXTENSIONS.AVAILABLE}
              onFileTypeToggle={handleFileTypeToggle}
              isLoading={scraping.isLoading}
              tooltipStates={ui.tooltipStates}
              onTooltipToggle={handleTooltipToggle}
            />
            
            {/* URL Pattern Configuration */}
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  <label className="text-sm font-medium text-foreground">URL Patterns</label>
                  <Tooltip open={ui.tooltipStates.urlPatterns} onOpenChange={(open) => handleTooltipToggle('urlPatterns')}>
                    <TooltipTrigger asChild>
                      <button onClick={() => handleTooltipToggle('urlPatterns')} className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="URL patterns info">
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
                  onClick={uiActions.toggleUrlPatterns}
                  className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
                >
                  {ui.showUrlPatterns ? 'Hide' : 'Configure'}
                </button>
              </div>
              
              {ui.showUrlPatterns && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Pattern Configuration (.env format)</label>
                    <textarea
                      value={filters.customUrlPatterns}
                      onChange={(e) => filterActions.setCustomUrlPatterns(e.target.value)}
                      placeholder={`# Example URL patterns:
# manga-site.com
url=https://manga-site.com/manga/title/chapter-1
config=/manga/title/chapter-{chapter}

# comic-reader.net  
url=https://comic-reader.net/comics/title/ch-001
config=/comics/title/ch-{chapter:03d}`}
                      className="w-full h-24 px-3 py-2 text-xs bg-input border border-border rounded-md text-foreground font-mono resize-none"
                      disabled={scraping.isLoading}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleUrlPatternsApply}
                      disabled={scraping.isLoading || !filters.customUrlPatterns.trim()}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Apply Patterns
                    </button>
                    <button
                      onClick={handleUrlPatternsExport}
                      disabled={scraping.isLoading}
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
              imageFilters={filters.imageFilters}
              newFilter={filters.newFilter}
              showImageFilters={ui.showImageFilters}
              isLoading={scraping.isLoading}
              tooltipOpen={ui.tooltipStates.imageFiltering}
              onTooltipOpenChange={(open) => handleTooltipToggle('imageFiltering')}
              onNewFilterChange={filterActions.setNewFilter}
              onShowFiltersToggle={uiActions.toggleImageFilters}
              onAddFilter={handleAddFilter}
              onRemoveFilter={handleRemoveFilter}
              onClearAllFilters={handleClearAllFilters}
            />
          </div>
        )}

        {/* Progress */}
        {scraping.progress && (
          <div className="mb-6">
            <ProgressIndicator progress={scraping.progress} />
          </div>
        )}

        {/* Error */}
        {scraping.error && (
          <div className="flex items-center space-x-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive mb-6">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{scraping.error}</span>
          </div>
        )}

        {/* Stats */}
        {scraping.images.length > 0 && (
          <div className="flex items-center space-x-6 p-4 bg-accent/10 border border-accent/20 rounded-lg mb-6">
            <div className="flex items-center space-x-2 text-accent">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">{scraping.stats.total} images found</span>
            </div>
            <div className="text-sm text-accent/80">
              {(() => {
                const filteredCount = scraping.images.filter(img => filterActions.shouldFilterImage(img.url)).length
                const displayedCount = scraping.images.length - filteredCount
                return `${displayedCount} displayed • ${filteredCount} filtered out • ${scraping.stats.duplicates} duplicates removed`
              })()}
            </div>
          </div>
        )}

        {/* Image Gallery */}
        {scraping.images.length > 0 && (
          <ImageGallery 
            images={scraping.images.filter(img => !filterActions.shouldFilterImage(img.url))} 
            websiteUrl={url} 
            onImageError={handleRemoveImageOnError} 
            onPreviewChange={uiActions.setPreviewActive} 
            showScrollButtons={configuration.showScrollButtons} 
            initialPreviewMode={ui.previewActive}
            autoNextChapter={configuration.autoNextChapter}
            onNextChapter={() => {
              const now = Date.now()
              // Increased cooldown to 30 seconds and check for loading state
              if (now - navigation.lastAutoScrollTime >= TIMING.AUTO_CHAPTER_COOLDOWN && !scraping.isLoading && !navigation.isNavigating) { 
                console.log('Auto next chapter triggered - starting scraping')
                navigationActions.updateLastScrollTime(now)
                
                // Update URL to next chapter and trigger scraping with the new URL
                const chapterInfo = parseChapterFromUrl(url)
                if (chapterInfo.hasChapter) {
                  const nextChapterNumber = chapterInfo.chapterNumber + configuration.chapterCount
                  const nextChapterUrl = updateChapterUrl(nextChapterNumber, true)
                  console.log(`Auto navigating to chapter ${nextChapterNumber}`)
                  
                  // Use the new URL directly instead of relying on state update
                  if (nextChapterUrl && nextChapterUrl !== url) {
                    handleScrapeWithUrl(nextChapterUrl)
                  } else {
                    console.warn('Failed to generate next chapter URL, falling back to current URL')
                    handleScrape()
                  }
                }
              } else {
                const remainingTime = Math.max(0, TIMING.AUTO_CHAPTER_COOLDOWN - (now - navigation.lastAutoScrollTime)) / 1000
                console.log(`Auto next chapter blocked: ${remainingTime.toFixed(1)}s cooldown remaining, loading: ${scraping.isLoading}, navigating: ${navigation.isNavigating}`)
              }
            }}
            onStartNavigation={handleStartNavigation}
            isNavigating={navigation.isNavigating}
          />
        )}
      </div>


      {/* Universal Navigation Lock Overlay */}
      {navigation.isNavigating && (
        <div 
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onTouchMove={(e) => e.preventDefault()}
          onWheel={(e) => e.preventDefault()}
          onScroll={(e) => e.preventDefault()}
          onClick={(e) => e.preventDefault()}
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          style={{ 
            touchAction: 'none',
            userSelect: 'none',
            pointerEvents: 'all'
          }}
        >
          <div 
            className="flex items-center space-x-4 bg-black/90 text-white px-8 py-6 rounded-xl shadow-2xl border border-white/20"
            style={{ pointerEvents: 'none' }}
          >
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
            <div className="text-xl font-semibold tracking-wide">
              Loading...
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageScraper
