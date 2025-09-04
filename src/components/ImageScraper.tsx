import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Filter, AlertCircle, CheckCircle, ChevronLeft, ChevronRight, Info, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import ImageGallery from './ImageGallery'
import ProgressIndicator from './ProgressIndicator'
import ThemeToggle from './ThemeToggle'
import { scrapeImages, ScrapedImage, ScrapeProgress } from '../utils/advancedImageScraper'
import { getNavigationState, parseChapterFromUrl } from '../utils/urlNavigation'
import { urlPatternManager } from '../utils/urlPatterns'

import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

const ImageScraper: React.FC = () => {
  const [url, setUrl] = useState('')
  const [fileTypes, setFileTypes] = useState<string[]>(['png', 'jpg', 'jpeg', 'webp'])
  const [isLoading, setIsLoading] = useState(false)
  const [images, setImages] = useState<ScrapedImage[]>([])
  const [progress, setProgress] = useState<ScrapeProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, duplicates: 0, filtered: 0 })
  const [stickyArrowsVisible, setStickyArrowsVisible] = useState<boolean>(true)
  const [lastScrollYMain, setLastScrollYMain] = useState<number>(0)
  const [previewActive, setPreviewActive] = useState<boolean>(false)
  const [isNavigating, setIsNavigating] = useState<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const upArrowClickTimeoutRef = useRef<number | null>(null)

  // Navigation lock with minimal fullscreen interference
  useEffect(() => {
    if (isNavigating) {
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
  }, [isNavigating])

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

  // Scroll detection for sticky arrows visibility (non-preview mode only)
  useEffect(() => {
    if (previewActive) return // Let ImageGallery handle scroll in preview mode

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight
      const isAtBottom = currentScrollY + windowHeight >= documentHeight - 10 // 10px threshold

      // Show arrows when:
      // 1. Scrolling up (currentScrollY < lastScrollYMain)
      // 2. At the bottom of the page
      // 3. At the very top (currentScrollY < 50)
      if (currentScrollY < lastScrollYMain || isAtBottom || currentScrollY < 50) {
        setStickyArrowsVisible(true)
      } else if (currentScrollY > lastScrollYMain) {
        // Hide arrows when scrolling down
        setStickyArrowsVisible(false)
      }

      setLastScrollYMain(currentScrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [previewActive, lastScrollYMain])

  // Handle button visibility changes from ImageGallery in preview mode
  const handleButtonVisibilityChange = (visible: boolean) => {
    if (previewActive) {
      setStickyArrowsVisible(visible)
    }
  }

  // Sequential pattern state for instant generation when detected
  const [sequentialPattern, setSequentialPattern] = useState<{ basePath: string; extension: string; pad: number } | null>(null)
  const [lastPageUrl, setLastPageUrl] = useState<string | null>(null)

  // New: scraping method and sticky arrows toggle
  const [scrapingMethod, setScrapingMethod] = useState<'smart' | 'fast'>('fast')
  const [stickyArrowsEnabled, setStickyArrowsEnabled] = useState<boolean>(true)
  const [showScrollButtons, setShowScrollButtons] = useState<boolean>(true)
  const [consecutiveMissThreshold, setConsecutiveMissThreshold] = useState<number>(3)
  const [chapterCount, setChapterCount] = useState<number>(1)
  const [validateImages, setValidateImages] = useState<boolean>(false)
  const [fetchInterval, setFetchInterval] = useState<number>(15) // seconds
  const [autoNextChapter, setAutoNextChapter] = useState<boolean>(false)
  const [lastAutoScrollTime, setLastAutoScrollTime] = useState<number>(0)
  // Tooltip open states for info buttons
  const [smartInfoOpen, setSmartInfoOpen] = useState<boolean>(false)
  const [fastInfoOpen, setFastInfoOpen] = useState<boolean>(false)
  const [navInfoOpen, setNavInfoOpen] = useState<boolean>(false)
  const [missInfoOpen, setMissInfoOpen] = useState<boolean>(false)
  const [chapterInfoOpen, setChapterInfoOpen] = useState<boolean>(false)
  const [validateInfoOpen, setValidateInfoOpen] = useState<boolean>(false)
  const [fetchIntervalInfoOpen, setFetchIntervalInfoOpen] = useState<boolean>(false)
  const [autoNextChapterInfoOpen, setAutoNextChapterInfoOpen] = useState<boolean>(false)
  
  // URL Pattern Configuration
  const [showUrlPatterns, setShowUrlPatterns] = useState<boolean>(false)
  const [customUrlPatterns, setCustomUrlPatterns] = useState<string>('')
  const [urlPatternsOpen, setUrlPatternsOpen] = useState<boolean>(false)
  
  // Chapter navigation state
  const [targetChapterRange, setTargetChapterRange] = useState<{start: number, end: number} | null>(null)

  const availableFileTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico']

  const handleFileTypeToggle = (type: string) => {
    setFileTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleChapterCountChange = (newChapterCount: number) => {
    setChapterCount(newChapterCount)
    // Enforce minimum 30 seconds for 15+ chapters
    if (newChapterCount >= 15 && fetchInterval < 30) {
      setFetchInterval(30)
    }
  }

  const handleFetchIntervalChange = (newInterval: number) => {
    // Enforce minimum intervals based on chapter count
    const minInterval = chapterCount >= 15 ? 30 : 15
    const finalInterval = Math.max(newInterval, minInterval)
    setFetchInterval(finalInterval)
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
      if (customUrlPatterns.trim()) {
        // Import custom patterns into the URL pattern manager
        urlPatternManager.importFromEnvFormat(customUrlPatterns)
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
      setCustomUrlPatterns(exported)
      if (exported) {
        toast.success('Current patterns exported to editor')
      } else {
        toast.info('No patterns configured to export')
      }
    } catch (error: any) {
      toast.error(`Failed to export URL patterns: ${error.message}`)
    }
  }

  const handleScrape = async () => {
    const chapterInfo = parseChapterFromUrl(url)
    if (chapterInfo.hasChapter && chapterCount > 1) {
      // Calculate and display target chapter range
      const startChapter = chapterInfo.chapterNumber
      const endChapter = startChapter + chapterCount - 1
      setTargetChapterRange({ start: startChapter, end: endChapter })
      
      // Update URL immediately to final position for better UX
      updateChapterUrl(endChapter, true)
      
      // Start scraping from original URL
      await handleScrapeWithUrl(chapterInfo.chapterNumber === startChapter ? url : generateChapterUrl(url, startChapter))
    } else {
      await handleScrapeWithUrl()
    }
    
    // Clear target range after scraping
    setTargetChapterRange(null)
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

  const generateSequentialScrapedImages = (basePath: string, extension: string, pad: number, count = 500) => {
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
  const handleStartNavigation = () => {
    setIsNavigating(true)
    
    // Clear navigation lock after 3 seconds
    setTimeout(() => {
      setIsNavigating(false)
    }, 3000)
  }

  const handleChapterNavigation = async (direction: 'prev' | 'next') => {
    const chapterInfo = parseChapterFromUrl(url)
    if (!chapterInfo.hasChapter) return
    
    // Calculate the target chapter range
    const increment = direction === 'next' ? chapterCount : -chapterCount
    const startChapter = chapterInfo.chapterNumber + increment
    const endChapter = startChapter + chapterCount - 1
    
    // Don't allow negative chapter numbers
    if (startChapter < 1) return
    
    // Set target range for visual feedback
    setTargetChapterRange({ start: startChapter, end: endChapter })
    
    // Start universal navigation lock
    setIsNavigating(true)
    
    // Update URL immediately to final position
    const finalChapterUrl = updateChapterUrl(endChapter, true)
    
    // Clear navigation lock after 3 seconds
    setTimeout(() => {
      setIsNavigating(false)
      setTargetChapterRange(null)
    }, 3000)
    
    // Generate starting URL for scraping
    const startingUrl = updateChapterUrl(startChapter, false)

    // If we have a sequential pattern detected from previous scrape, assume same structure in next chapters
    if (sequentialPattern && lastPageUrl) {
      const oldChapterInfo = parseChapterFromUrl(lastPageUrl)
      const newChapterInfo = parseChapterFromUrl(startingUrl)
      if (oldChapterInfo.hasChapter && newChapterInfo.hasChapter) {
        const oldSeg = oldChapterInfo.chapterSegment
        const newSeg = newChapterInfo.chapterSegment
        let newBase = sequentialPattern.basePath
        if (!newBase.endsWith('/')) newBase = newBase + '/'
        if (oldSeg && newSeg && newBase.includes(oldSeg)) {
          // Generate images for multiple chapters
          const allImages: ScrapedImage[] = []
          for (let i = 0; i < chapterCount; i++) {
            const chapterNum = startChapter + i
            const chapterSegment = newSeg.replace(startChapter.toString(), chapterNum.toString())
            const chapterBase = newBase.replace(oldSeg + '/', chapterSegment + '/')
            const chapterImages = generateSequentialScrapedImages(chapterBase, sequentialPattern.extension, sequentialPattern.pad, 500)
            // Add chapter info to alt text
            chapterImages.forEach(img => {
              img.alt = `Image from ${new URL(startingUrl).hostname} - Chapter ${chapterNum}`
            })
            allImages.push(...chapterImages)
          }
          
          setImages(allImages)
          setStats({ total: allImages.length, duplicates: 0, filtered: allImages.length })
          // URL already updated to final position above
          setLastPageUrl(finalChapterUrl)
          setSequentialPattern({ basePath: newBase.replace(oldSeg + '/', newSeg + '/'), extension: sequentialPattern.extension, pad: sequentialPattern.pad })
          return
        }
      }
    }

    // Fallback: perform a normal scrape on the starting URL
    // URL already updated to final position above
    handleScrapeWithUrl(startingUrl)
  }

  // Progress handler that supports live insertion of images reported by the scraper
  const handleProgress = useCallback((p: ScrapeProgress) => {
    setProgress(p)
    
    // Handle chapter results and show failure notifications
    if (p.chapterResults && chapterCount > 1) {
      const latestResult = p.chapterResults[p.chapterResults.length - 1]
      if (latestResult && !latestResult.success) {
        toast.error(`Chapter ${latestResult.chapterNumber} failed: ${latestResult.error}`)
      }
    }
    
    if (p.image) {
      setImages(prev => {
        // avoid duplicates
        if (prev.find(i => i.url === p.image!.url)) return prev
        const next = [...prev, p.image!]
        setStats({ total: next.length, duplicates: 0, filtered: next.length })
        return next
      })
    }
  }, [])

  // Live image insertion handler
  const handleNewImage = useCallback((image: ScrapedImage) => {
    setImages(prev => {
      // avoid duplicates
      if (prev.find(i => i.url === image.url)) return prev
      const next = [...prev, image]
      setStats({ total: next.length, duplicates: 0, filtered: next.length })
      return next
    })
  }, [])

  const handleScrapeWithUrl = async (targetUrl?: string) => {
    const scrapeUrl = targetUrl || url
    
    if (!scrapeUrl.trim()) {
      setError('Please enter a valid URL')
      toast.error('Please enter a valid URL')
      return
    }

    if (fileTypes.length === 0) {
      setError('Please select at least one file type')
      toast.error('Please select at least one file type')
      return
    }

    // Only set navigation lock if not already set by navigation
    if (!isNavigating) {
      setIsNavigating(true)
      
      // Clear navigation lock after 3 seconds
      setTimeout(() => {
        setIsNavigating(false)
        setTargetChapterRange(null)
      }, 3000)
    }

    setIsLoading(true)
    setError(null)
    setImages([])
    setStats({ total: 0, duplicates: 0, filtered: 0 })
    setSequentialPattern(null)

    abortControllerRef.current = new AbortController()

    try {
      toast.info(`Starting to scrape images from ${new URL(scrapeUrl).hostname}...`)

      const options: any = {
        onProgress: handleProgress,
        onNewImage: handleNewImage,
        signal: abortControllerRef.current.signal,
        consecutiveMissThreshold,
        chapterCount,
        validateImages,
        fetchInterval: fetchInterval * 1000 // Convert seconds to milliseconds
      }

      if (scrapingMethod === 'fast') {
        // prefer sequence-only fast generation
        options.preferSequenceOnly = true
        options.keepAliveMs = 0
        options.consecutiveMissThreshold = consecutiveMissThreshold
      }

      const scrapedImages = await scrapeImages(scrapeUrl, fileTypes, options)

      // Merge returned images with any live-inserted images ensuring uniqueness
      setImages(prev => {
        const map = new Map<string, ScrapedImage>()
        prev.forEach(i => map.set(i.url, i))
        scrapedImages.forEach(i => map.set(i.url, i))
        const merged = Array.from(map.values())
        setStats({ total: merged.length, duplicates: 0, filtered: merged.length })
        return merged
      })

      // Save last page URL for chapter navigation
      setLastPageUrl(scrapeUrl)

      // Detect sequential pattern from returned images and save for quick generation
      const seq = detectSequentialPatternFromUrls(scrapedImages.map(s => s.url))
      if (seq) {
        let normalized = seq.basePath
        if (!normalized.endsWith('/')) normalized = normalized + '/'
        setSequentialPattern({ basePath: normalized, extension: seq.extension, pad: seq.pad })
      }
      
      if ((scrapedImages && scrapedImages.length) || images.length > 0) {
        // Show chapter results summary for multi-chapter scraping
        if (chapterCount > 1 && progress?.chapterResults) {
          const successful = progress.chapterResults.filter(r => r.success)
          const failed = progress.chapterResults.filter(r => !r.success)
          const totalImages = successful.reduce((sum, r) => sum + r.imageCount, 0)
          
          if (failed.length > 0) {
            toast.warning(`Multi-chapter scraping completed with issues`, {
              description: `Found ${totalImages} images across ${successful.length}/${chapterCount} chapters. Failed chapters: ${failed.map(r => r.chapterNumber).join(', ')}`
            })
          } else {
            toast.success(`Multi-chapter scraping completed successfully`, {
              description: `Found ${totalImages} images across all ${chapterCount} chapters`
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
      let errorMessage = err.message || 'Failed to scrape images'
      let toastDescription = errorMessage
      
      // Handle CORS-specific errors with helpful messages
      if (errorMessage.includes('proxy services failed') || errorMessage.includes('CORS')) {
        errorMessage = 'Unable to access website due to security restrictions'
        toastDescription = 'The website blocks direct access. Try a different site or check if the URL is correct.'
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        errorMessage = 'Network error or website is unreachable'
        toastDescription = 'Check your internet connection and verify the URL is correct.'
      }
      
      setError(errorMessage)
      toast.error('Scraping failed', {
        description: toastDescription
      })
    }
    } finally {
    setIsLoading(false)
    setProgress(null)
    }
  }

  // Remove an image URL from the list (called when browser reports 1st-load 404)
  const handleRemoveImageOnError = (urlToRemove: string) => {
    setImages(prev => {
      const filtered = prev.filter(i => i.url !== urlToRemove)
      setStats({ total: filtered.length, duplicates: 0, filtered: filtered.length })
      return filtered
    })
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
                  disabled={isLoading}
                />
              </div>

              {/* Chapter Navigation */}
              {(() => {
                const navState = getNavigationState(url)
                const chapterInfo = parseChapterFromUrl(url)
                return chapterInfo.hasChapter ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center space-x-3 p-3 bg-accent/10 border border-accent/20 rounded-lg">
                      <button
                        onClick={() => handleChapterNavigation('prev')}
                        disabled={!navState.canGoPrev || isLoading || chapterInfo.chapterNumber <= chapterCount}
                        className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
                          navState.canGoPrev && !isLoading && chapterInfo.chapterNumber > chapterCount
                            ? 'bg-card border-border hover:bg-accent text-foreground'
                            : 'bg-muted border-muted text-muted-foreground cursor-not-allowed'
                        }`}
                        title={`Previous ${chapterCount} chapter(s)`}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>

                      <div className="flex items-center space-x-2 text-sm text-foreground">
                        <div className="text-center">
                          <span className="block">Chapter {chapterInfo.chapterNumber}</span>
                          {targetChapterRange && (
                            <span className="text-xs text-muted-foreground">
                              Loading {targetChapterRange.start}-{targetChapterRange.end}
                            </span>
                          )}
                          {!targetChapterRange && chapterCount > 1 && (
                            <span className="text-xs text-muted-foreground">
                              Will load {chapterCount} chapters
                            </span>
                          )}
                        </div>
                        <Tooltip open={navInfoOpen} onOpenChange={setNavInfoOpen}>
                          <TooltipTrigger asChild>
                            <button onClick={() => setNavInfoOpen(prev => !prev)} className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Navigation info">
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Use the chapter navigation buttons to jump by {chapterCount} chapter(s). The URL will update to the final chapter position.
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      <button
                        onClick={() => handleChapterNavigation('next')}
                        disabled={!navState.canGoNext || isLoading}
                        className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
                          navState.canGoNext && !isLoading
                            ? 'bg-card border-border hover:bg-accent text-foreground'
                            : 'bg-muted border-muted text-muted-foreground cursor-not-allowed'
                        }`}
                        title={`Next ${chapterCount} chapter(s)`}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : null
              })()}

              {/* Start/Stop Button */}
              <div className="flex justify-center">
                {!isLoading ? (
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
              </div>
            </div>
          </div>

          {/* Configuration Options */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Configuration</h3>
            
            {/* Current Settings Display */}
            {(() => {
              const chapterInfo = parseChapterFromUrl(url)
              return chapterInfo.hasChapter ? (
                <div className="mb-6 p-3 bg-accent/10 border border-accent/20 rounded-lg text-center">
                  <div className="flex items-center justify-center space-x-2 text-sm text-foreground">
                    <span>📖</span>
                    {targetChapterRange ? (
                      <span>Loading chapters {targetChapterRange.start}-{targetChapterRange.end}...</span>
                    ) : (
                      <span>Chapter {chapterInfo.chapterNumber} detected - Will fetch {chapterCount} chapter(s) per action</span>
                    )}
                  </div>
                </div>
              ) : null
            })()}
            
            {/* Main Settings Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Left Column - Core Settings */}
              <div className="space-y-4">
                {/* Scraping Method */}
                <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                  <label className="text-sm font-medium text-foreground mb-4 block text-center">Scraping Method</label>
                  <div className="flex justify-center gap-4">
                    <div className={`relative flex-1 max-w-32 rounded-lg border-2 transition-all duration-200 ${
                      scrapingMethod === 'smart' 
                        ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                        : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-accent/20'
                    }`}>
                      <button
                        onClick={() => setScrapingMethod('smart')}
                        className="w-full px-4 py-3 rounded-lg"
                        disabled={isLoading}
                        aria-label="Smart scraping method"
                      >
                        <div className="text-center">
                          <div className="font-semibold">Smart</div>
                          <div className="text-xs mt-1 opacity-80">Thorough detection</div>
                        </div>
                      </button>
                      <Tooltip open={smartInfoOpen} onOpenChange={setSmartInfoOpen}>
                        <TooltipTrigger asChild>
                          <button 
                            onClick={() => setSmartInfoOpen(prev => !prev)} 
                            className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                              scrapingMethod === 'smart' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                            }`}
                            aria-label="Smart method info"
                          >
                            <Info className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Runs thorough DOM + JS detection to find all images on the page.</TooltipContent>
                      </Tooltip>
                    </div>

                    <div className={`relative flex-1 max-w-32 rounded-lg border-2 transition-all duration-200 ${
                      scrapingMethod === 'fast' 
                        ? 'bg-primary text-primary-foreground border-primary shadow-md' 
                        : 'bg-card text-foreground border-border hover:border-primary/50 hover:bg-accent/20'
                    }`}>
                      <button
                        onClick={() => setScrapingMethod('fast')}
                        className="w-full px-4 py-3 rounded-lg"
                        disabled={isLoading}
                        aria-label="Fast scraping method"
                      >
                        <div className="text-center">
                          <div className="font-semibold">Fast</div>
                          <div className="text-xs mt-1 opacity-80">Sequential URLs</div>
                        </div>
                      </button>
                      <Tooltip open={fastInfoOpen} onOpenChange={setFastInfoOpen}>
                        <TooltipTrigger asChild>
                          <button 
                            onClick={() => setFastInfoOpen(prev => !prev)} 
                            className={`absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                              scrapingMethod === 'fast' ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-muted'
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
                          onChange={(e) => setConsecutiveMissThreshold(Number(e.target.value))}
                          className="w-full pl-3 pr-8 py-2 text-sm bg-input border border-border rounded-md text-foreground appearance-none"
                          disabled={isLoading}
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                        </select>
                        <Tooltip open={missInfoOpen} onOpenChange={setMissInfoOpen}>
                          <TooltipTrigger asChild>
                            <button onClick={() => setMissInfoOpen(prev => !prev)} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Miss info">
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
                          onChange={(e) => handleChapterCountChange(Number(e.target.value))}
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
                        <Tooltip open={chapterInfoOpen} onOpenChange={setChapterInfoOpen}>
                          <TooltipTrigger asChild>
                            <button onClick={() => setChapterInfoOpen(prev => !prev)} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Chapters info">
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Number of chapters to fetch in a single action when navigating.</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  
                  {/* Auto Next Chapter Toggle */}
                  <div className="mt-3 pt-3 border-t border-accent/20">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-muted-foreground">Auto Next Chapter (Preview Mode)</label>
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoNextChapter}
                            onChange={(e) => setAutoNextChapter(e.target.checked)}
                            className="sr-only peer"
                            disabled={isLoading}
                          />
                          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-background after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                        <Tooltip open={autoNextChapterInfoOpen} onOpenChange={setAutoNextChapterInfoOpen}>
                          <TooltipTrigger asChild>
                            <button 
                              onClick={() => setAutoNextChapterInfoOpen(prev => !prev)} 
                              className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" 
                              aria-label="Auto next chapter info"
                            >
                              <Info className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Automatically loads the next chapter when scrolling to the bottom in preview mode</TooltipContent>
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
                        onChange={(e) => handleFetchIntervalChange(Number(e.target.value))}
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
                      <Tooltip open={fetchIntervalInfoOpen} onOpenChange={setFetchIntervalInfoOpen}>
                        <TooltipTrigger asChild>
                          <button onClick={() => setFetchIntervalInfoOpen(prev => !prev)} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Fetch interval info">
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
                          checked={stickyArrowsEnabled} 
                          onChange={(e) => setStickyArrowsEnabled(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-4 h-4 rounded border-2 transition-all duration-200 ${
                          stickyArrowsEnabled 
                            ? 'bg-primary border-primary' 
                            : 'bg-background border-border hover:border-primary/50'
                        }`}>
                          {stickyArrowsEnabled && (
                            <svg className="w-3 h-3 text-primary-foreground absolute top-0.5 left-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                      <span className="text-foreground">Show sticky navigation arrows</span>
                    </label>

                    <label className="flex items-center space-x-3 text-sm cursor-pointer">
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          checked={showScrollButtons} 
                          onChange={(e) => setShowScrollButtons(e.target.checked)}
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

                {/* Validation Options */}
                <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
                  <h4 className="text-sm font-medium text-foreground mb-3">Validation Settings</h4>
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="validateImages"
                      checked={validateImages}
                      onChange={(e) => setValidateImages(e.target.checked)}
                      className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary focus:ring-2"
                      disabled={isLoading}
                    />
                    <label htmlFor="validateImages" className="text-sm text-foreground cursor-pointer flex-1">
                      Validate images before adding
                    </label>
                    
                    <Tooltip open={validateInfoOpen} onOpenChange={setValidateInfoOpen}>
                      <TooltipTrigger asChild>
                        <button onClick={() => setValidateInfoOpen(prev => !prev)} className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Validation info">
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
              </div>
            </div>

            {/* File Types Section */}
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="flex items-center space-x-2 mb-4">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">File Types ({fileTypes.length} selected)</label>
              </div>
              <div className="flex flex-wrap gap-2">
                {availableFileTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => handleFileTypeToggle(type)}
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
            
            {/* URL Pattern Configuration */}
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-muted-foreground" />
                  <label className="text-sm font-medium text-foreground">URL Patterns</label>
                  <Tooltip open={urlPatternsOpen} onOpenChange={setUrlPatternsOpen}>
                    <TooltipTrigger asChild>
                      <button onClick={() => setUrlPatternsOpen(prev => !prev)} className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="URL patterns info">
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
                  onClick={() => setShowUrlPatterns(prev => !prev)}
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
                      onChange={(e) => setCustomUrlPatterns(e.target.value)}
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
                      onClick={handleUrlPatternsApply}
                      disabled={isLoading || !customUrlPatterns.trim()}
                      className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      Apply Patterns
                    </button>
                    <button
                      onClick={handleUrlPatternsExport}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
                    >
                      Export Current
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Progress */}
          {progress && (
            <ProgressIndicator progress={progress} />
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center space-x-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Stats */}
          {images.length > 0 && (
            <div className="flex items-center space-x-6 p-4 bg-accent/10 border border-accent/20 rounded-lg">
              <div className="flex items-center space-x-2 text-accent">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">{stats.total} images found</span>
              </div>
              <div className="text-sm text-accent/80">
                {stats.filtered} after filtering • {stats.duplicates} duplicates removed
              </div>
            </div>
          )}
        </div>

        {/* Image Gallery */}
        {images.length > 0 && (
          <ImageGallery 
            images={images} 
            websiteUrl={url} 
            onImageError={handleRemoveImageOnError} 
            onPreviewChange={setPreviewActive} 
            onButtonVisibilityChange={handleButtonVisibilityChange}
            showScrollButtons={showScrollButtons} 
            initialPreviewMode={previewActive}
            autoNextChapter={autoNextChapter}
            onNextChapter={() => {
              const now = Date.now()
              if (now - lastAutoScrollTime >= 20000) { // 20 second cooldown
                setLastAutoScrollTime(now)
                handleChapterNavigation('next')
              }
            }}
            onStartNavigation={handleStartNavigation}
            isNavigating={isNavigating}
          />
        )}
      </div>

      {/* Sticky bottom-center navigation arrows */}
      {stickyArrowsEnabled && (() => {
        const chapterInfo = parseChapterFromUrl(url)
        const navState = getNavigationState(url)
        if (!chapterInfo.hasChapter) return null
        return (
          <div className={`fixed bottom-3 left-1/2 transform -translate-x-1/2 transition-all duration-300 ${
            stickyArrowsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`} style={{ zIndex: previewActive ? 9999 : undefined }}>
            <div className="flex items-center space-x-2 bg-card/70 backdrop-blur-sm px-2 py-1.5 rounded-full shadow-md border border-border/50">
              <button
                onClick={() => handleChapterNavigation('prev')}
                disabled={!navState.canGoPrev || isLoading}
                className={`p-3 rounded-full border transition-colors flex items-center justify-center ${
                  navState.canGoPrev && !isLoading
                    ? 'bg-card/80 border-border/60 hover:bg-accent text-foreground'
                    : 'bg-muted/60 border-muted text-muted-foreground cursor-not-allowed'
                }`}
                title={`Previous chapter`}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={() => handleChapterNavigation('next')}
                disabled={!navState.canGoNext || isLoading}
                className={`p-3 rounded-full border transition-colors flex items-center justify-center ${
                  navState.canGoNext && !isLoading
                    ? 'bg-card/80 border-border/60 hover:bg-accent text-foreground'
                    : 'bg-muted/60 border-muted text-muted-foreground cursor-not-allowed'
                }`}
                title={`Next chapter`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        )
      })()}

      {/* Universal Navigation Lock Overlay */}
      {isNavigating && (
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
