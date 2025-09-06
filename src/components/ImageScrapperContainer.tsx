import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { ScrapingInputSection } from './ScrapingInputSection'
import { ScrapingStatusSection } from './ScrapingStatusSection'
import { ScrapingResultsSection } from './ScrapingResultsSection'
import { ScrapingConfigurationSection } from './ScrapingConfigurationSection'
import ThemeToggle from './ThemeToggle'
import { scrapeImages, ScrapeProgress, clearRequestCache, detectStrongSequentialPattern } from '../utils/advancedImageScraper'
import { parseChapterFromUrl } from '../utils/urlNavigation'
import { useImageScrapingState } from '../hooks/useImageScrapingState'
import { TIMING, ERROR_MESSAGES } from '../constants'

const ImageScrapperContainer: React.FC = () => {
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

  // Memoized computed values for performance
  const filteredCount = useMemo(() => 
    scraping.images.filter(img => filterActions.shouldFilterImage(img.url)).length,
    [scraping.images, filterActions.shouldFilterImage]
  )

  const displayedCount = useMemo(() => 
    scraping.images.length - filteredCount,
    [scraping.images.length, filteredCount]
  )

  // Navigation lock with minimal fullscreen interference
  useEffect(() => {
    if (navigation.isNavigating) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      // Navigation lock active
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      // Navigation lock restored
    }

    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [navigation.isNavigating])

  // Safety mechanism: reset stuck states after component mount
  useEffect(() => {
    const resetStuckStates = () => {
      if (!scraping.isLoading && navigation.isNavigating) {
        // Detected stuck navigation state, resetting
        navigationActions.setNavigating(false)
      }
    }
    
    const interval = setInterval(resetStuckStates, TIMING.SAFETY_CHECK_INTERVAL)
    return () => clearInterval(interval)
  }, [scraping.isLoading, navigation.isNavigating, navigationActions])

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

  // Memoized callbacks to prevent unnecessary re-renders
  const handleTooltipToggle = useCallback((key: string) => {
    uiActions.toggleTooltip(key)
  }, [uiActions])

  const handleFileTypeToggle = useCallback((type: string) => {
    configurationActions.toggleFileType(type)
  }, [configurationActions])

  const updateChapterUrl = useCallback((chapterNumber: number, immediate = false): string => {
    if (!url) return ''
    
    try {
      const baseUrl = url
      const chapterInfo = parseChapterFromUrl(baseUrl)
      
      if (!chapterInfo.hasChapter) return baseUrl
      
      const urlParts = new URL(baseUrl)
      const pathSegments = urlParts.pathname.split('/').filter(segment => segment.length > 0)
      
      const updatedSegments = pathSegments.map(segment => {
        if (segment === chapterInfo.chapterSegment) {
          return chapterInfo.chapterSegment.replace(/\d+/g, chapterNumber.toString())
        }
        return segment
      })
      
      const newUrl = `${urlParts.origin}/${updatedSegments.join('/')}`
      
      if (immediate) {
        setUrl(newUrl)
      }
      
      return newUrl
    } catch (error) {
      console.error('Error updating chapter URL:', error)
      return url
    }
  }, [url])

  const handleStartNavigation = useCallback(() => {
    navigationActions.setNavigating(true)
    setTimeout(() => {
      navigationActions.setNavigating(false)
    }, TIMING.EXTENDED_NAVIGATION_LOCK)
  }, [navigationActions])

  const handlePreviewEnter = useCallback(() => {
    navigationActions.updatePreviewEnterTime(Date.now())
  }, [navigationActions])

  // Progress handler with live insertion support
  const handleProgress = useCallback((p: ScrapeProgress) => {
    // Progress update received
    scrapingActions.handleProgress(p)
    
    // Handle chapter results and show failure notifications
    if (p.chapterResults && configuration.chapterCount > 1) {
      const latestResult = p.chapterResults[p.chapterResults.length - 1]
      if (latestResult && !latestResult.success && latestResult.error !== 'Aborted') {
        toast.warning(`Chapter ${latestResult.chapterNumber} failed: ${latestResult.error}`, {
          duration: 3000
        })
      }
    }
    
    if (p.image && !scraping.isImageStateResetting) {
      // Adding new image
      scrapingActions.handleNewImage(p.image)
    } else if (p.image && scraping.isImageStateResetting) {
      // Image blocked by reset state
    }
  }, [configuration.chapterCount, scraping.isImageStateResetting, scrapingActions])

  // Main scraping function
  const handleScrapeWithUrl = useCallback(async (scrapeUrl: string) => {
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

    // Only set navigation lock if not already set by navigation
    if (!navigation.isNavigating) {
      navigationActions.setNavigating(true)
      
      setTimeout(() => {
        navigationActions.setNavigating(false)
      }, TIMING.NAVIGATION_LOCK_TIMEOUT)
    }

    scrapingActions.setIsLoading(true)
    scrapingActions.setError(null)
    
    await scrapingActions.resetState()
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
        fetchInterval: configuration.fetchInterval * 1000,
        imageFilter: filterActions.shouldFilterImage
      }

      // Starting scrape operation
      const scrapedImages = await scrapeImages(scrapeUrl, configuration.fileTypes, options)

      scrapedImages.forEach(image => scrapingActions.handleNewImage(image))
      navigationActions.setLastPageUrl(scrapeUrl)

      // Detect sequential pattern from returned images
      const seq = detectStrongSequentialPattern(scrapedImages.map(s => s.url))
      if (seq) {
        // Sequential pattern detected
        let normalized = seq.basePath
        if (!normalized.endsWith('/')) normalized = normalized + '/'
        scrapingActions.setSequentialPattern({ basePath: normalized, extension: seq.extension, pad: seq.pad })
      }
      
      if ((scrapedImages && scrapedImages.length) || scraping.images.length > 0) {
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
          description: 'Try adjusting the file types or check if the URL is accessible.'
        })
      }
    } catch (err: any) {
      let errorMessage = err.message || ERROR_MESSAGES.SCRAPING_FAILED

      if (err.message?.includes('fetch')) {
        errorMessage = ERROR_MESSAGES.CORS_ERROR
      } else if (err.message?.includes('Network')) {
        errorMessage = ERROR_MESSAGES.NETWORK_ERROR
      }

      scrapingActions.setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      scrapingActions.setIsLoading(false)
      scrapingActions.handleProgress(null)
      navigationActions.setNavigating(false)
    }
  }, [
    configuration, 
    navigation.isNavigating, 
    scrapingActions, 
    navigationActions, 
    filterActions.shouldFilterImage, 
    handleProgress,
    scraping.images.length,
    scraping.progress?.chapterResults
  ])

  const handleScrape = useCallback(() => {
    if (scraping.isLoading) {
      abortControllerRef.current?.abort()
      return
    }
    handleScrapeWithUrl(url)
  }, [scraping.isLoading, url, handleScrapeWithUrl])

  // Additional handlers
  const handleChapterCountChange = useCallback((count: number) => {
    configurationActions.updateChapterCount(count)
  }, [configurationActions])

  const handleFetchIntervalChange = useCallback((interval: number) => {
    configurationActions.updateFetchInterval(interval)
  }, [configurationActions])

  const handleRemoveImageOnError = useCallback((imageUrl: string) => {
    scrapingActions.removeImageOnError(imageUrl)
  }, [scrapingActions])

  const handleAddFilter = useCallback(() => {
    if (filters.newFilter.trim() && !filters.imageFilters.includes(filters.newFilter.trim().toLowerCase())) {
      const filter = filters.newFilter.trim().toLowerCase()
      filterActions.addFilter(filter)
      filterActions.setNewFilter('')
    }
  }, [filters.newFilter, filters.imageFilters, filterActions])

  const handleRemoveFilter = useCallback((filterToRemove: string) => {
    filterActions.removeFilter(filterToRemove)
  }, [filterActions])

  const handleClearAllFilters = useCallback(() => {
    filterActions.clearAllFilters()
  }, [filterActions])

  const handleUrlPatternsApply = useCallback(() => {
    filterActions.applyUrlPatterns()
    toast.success('URL patterns applied successfully')
  }, [filterActions])

  const handleUrlPatternsExport = useCallback(() => {
    filterActions.exportUrlPatterns()
    toast.success('URL patterns exported to clipboard')
  }, [filterActions])

  const handleNextChapter = useCallback((nextUrl: string) => {
    navigationActions.updateLastScrollTime(Date.now())
    handleScrapeWithUrl(nextUrl)
  }, [navigationActions, handleScrapeWithUrl])

  const handlePreviousChapter = useCallback(() => {
    if (!url) return
    
    const chapterInfo = parseChapterFromUrl(url)
    if (chapterInfo.hasChapter && chapterInfo.chapterNumber > 1) {
      const prevChapterNumber = chapterInfo.chapterNumber - 1
      const prevChapterUrl = updateChapterUrl(prevChapterNumber, true)
      
      if (prevChapterUrl && prevChapterUrl !== url) {
        handleScrapeWithUrl(prevChapterUrl)
      }
    }
  }, [url, updateChapterUrl, handleScrapeWithUrl])

  const handleManualNextChapter = useCallback(() => {
    if (!url) return
    
    const chapterInfo = parseChapterFromUrl(url)
    if (chapterInfo.hasChapter) {
      const nextChapterNumber = chapterInfo.chapterNumber + configuration.chapterCount
      const nextChapterUrl = updateChapterUrl(nextChapterNumber, true)
      
      if (nextChapterUrl && nextChapterUrl !== url) {
        handleScrapeWithUrl(nextChapterUrl)
      }
    }
  }, [url, configuration.chapterCount, updateChapterUrl, handleScrapeWithUrl])

  // Calculate if auto navigation is allowed - needs to be recalculated frequently for accurate timing
  const canAutoNavigate = (() => {
    const now = Date.now()
    const autoScrollCooldownOK = now - navigation.lastAutoScrollTime >= TIMING.AUTO_CHAPTER_COOLDOWN
    const previewEnterCooldownOK = now - navigation.lastPreviewEnterTime >= TIMING.AUTO_CHAPTER_PREVIEW_DELAY
    const result = autoScrollCooldownOK && previewEnterCooldownOK && !scraping.isLoading && !navigation.isNavigating
    
    // Debug logging for troubleshooting
    if (!result) {
      console.log('🔍 canAutoNavigate = false:', {
        autoScrollCooldownOK,
        previewEnterCooldownOK,
        isLoading: scraping.isLoading,
        isNavigating: navigation.isNavigating,
        lastAutoScrollTime: new Date(navigation.lastAutoScrollTime).toLocaleTimeString(),
        lastPreviewEnterTime: new Date(navigation.lastPreviewEnterTime).toLocaleTimeString(),
        cooldownsRemaining: {
          autoScroll: Math.max(0, TIMING.AUTO_CHAPTER_COOLDOWN - (now - navigation.lastAutoScrollTime)) / 1000,
          previewEnter: Math.max(0, TIMING.AUTO_CHAPTER_PREVIEW_DELAY - (now - navigation.lastPreviewEnterTime)) / 1000
        }
      })
    }
    
    return result
  })()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Lock Overlay */}
      {navigation.isNavigating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="text-foreground">Navigating...</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-card shadow-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Webster</h1>
              <p className="text-sm text-muted-foreground mt-1">Advanced Image Scraper</p>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Section */}
        <ScrapingInputSection
          url={url}
          onUrlChange={setUrl}
          onScrape={handleScrape}
          isLoading={scraping.isLoading}
          chapterCount={configuration.chapterCount}
          navTooltipOpen={ui.tooltipStates.navInfo}
          onNavTooltipToggle={(_open) => handleTooltipToggle('navInfo')}
          showConfiguration={ui.showConfiguration}
          onToggleConfiguration={uiActions.toggleConfiguration}
        />

        {/* Configuration Section */}
        <ScrapingConfigurationSection
          showConfiguration={ui.showConfiguration}
          onToggleConfiguration={uiActions.toggleConfiguration}
          url={url}
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
          onFileTypeToggle={handleFileTypeToggle}
          isLoading={scraping.isLoading}
          tooltipStates={ui.tooltipStates}
          onTooltipToggle={handleTooltipToggle}
          showUrlPatterns={ui.showUrlPatterns}
          onToggleUrlPatterns={uiActions.toggleUrlPatterns}
          customUrlPatterns={filters.customUrlPatterns}
          onCustomUrlPatternsChange={filterActions.setCustomUrlPatterns}
          onUrlPatternsApply={handleUrlPatternsApply}
          onUrlPatternsExport={handleUrlPatternsExport}
          showImageFilters={ui.showImageFilters}
          onToggleImageFilters={uiActions.toggleImageFilters}
          imageFilters={filters.imageFilters}
          newFilter={filters.newFilter}
          onNewFilterChange={filterActions.setNewFilter}
          onAddFilter={handleAddFilter}
          onRemoveFilter={handleRemoveFilter}
          onClearAllFilters={handleClearAllFilters}
        />

        {/* Status Section */}
        <ScrapingStatusSection
          progress={scraping.progress}
          error={scraping.error}
          imageCount={scraping.images.length}
          stats={scraping.stats}
          filteredCount={filteredCount}
          displayedCount={displayedCount}
        />

        {/* Results Section */}
        <ScrapingResultsSection
          images={scraping.images}
          url={url}
          filterFunction={filterActions.shouldFilterImage}
          onImageError={handleRemoveImageOnError}
          onPreviewChange={uiActions.setPreviewActive}
          showScrollButtons={configuration.showScrollButtons}
          initialPreviewMode={ui.previewActive}
          autoNextChapter={configuration.autoNextChapter}
          onNextChapter={handleNextChapter}
          onManualNextChapter={handleManualNextChapter}
          onStartNavigation={handleStartNavigation}
          onPreviewEnter={handlePreviewEnter}
          onPreviousChapter={handlePreviousChapter}
          currentChapter={url ? parseChapterFromUrl(url).chapterNumber : 0}
          canAutoNavigate={canAutoNavigate}
          isNavigating={navigation.isNavigating}
          isLoading={scraping.isLoading}
          lastAutoScrollTime={navigation.lastAutoScrollTime}
          lastPreviewEnterTime={navigation.lastPreviewEnterTime}
          chapterCount={configuration.chapterCount}
          updateChapterUrl={updateChapterUrl}
          updateLastScrollTime={navigationActions.updateLastScrollTime}
        />
      </div>
    </div>
  )
}

export default ImageScrapperContainer