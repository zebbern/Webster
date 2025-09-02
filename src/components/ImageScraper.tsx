import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Search, Download, Filter, Image as ImageIcon, AlertCircle, CheckCircle, Loader2, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { toast } from 'sonner'
import ImageGallery from './ImageGallery'
import ProgressIndicator from './ProgressIndicator'
import ThemeToggle from './ThemeToggle'
import { scrapeImages, ScrapedImage, ScrapeProgress } from '../utils/advancedImageScraper'
import { getNavigationState, parseChapterFromUrl, generateChapterUrl } from '../utils/urlNavigation'

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
  const abortControllerRef = useRef<AbortController | null>(null)
  const upArrowClickTimeoutRef = useRef<number | null>(null)

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

  // Scroll detection for sticky arrows visibility
  useEffect(() => {
    let lastScrollRef = lastScrollYMain
    
    const handleScroll = () => {
      let currentScrollY: number
      let windowHeight: number
      let documentHeight: number
      
      if (previewActive) {
        // In preview mode, use the preview container's scroll
        const previewContainer = document.getElementById('preview-overlay-scroll')
        if (!previewContainer) {
          console.log('Preview container not found')
          return
        }
        currentScrollY = previewContainer.scrollTop
        windowHeight = previewContainer.clientHeight
        documentHeight = previewContainer.scrollHeight
        console.log('Preview mode scroll:', { currentScrollY, lastScrollRef, windowHeight, documentHeight })
      } else {
        // In normal mode, use window scroll
        currentScrollY = window.scrollY
        windowHeight = window.innerHeight
        documentHeight = document.documentElement.scrollHeight
        console.log('Normal mode scroll:', { currentScrollY, lastScrollRef })
      }
      
      const isAtBottom = currentScrollY + windowHeight >= documentHeight - 10 // 10px threshold

      // Show arrows when:
      // 1. Scrolling up (currentScrollY < lastScrollRef)
      // 2. At the bottom of the page
      // 3. At the very top (currentScrollY < 50)
      if (currentScrollY < lastScrollRef || isAtBottom || currentScrollY < 50) {
        console.log('Showing arrows - scroll up or at bottom/top')
        setStickyArrowsVisible(true)
      } else if (currentScrollY > lastScrollRef) {
        // Hide arrows when scrolling down
        console.log('Hiding arrows - scrolling down')
        setStickyArrowsVisible(false)
      }

      lastScrollRef = currentScrollY
      setLastScrollYMain(currentScrollY)
    }

    // Small delay to ensure DOM elements are available
    const setupScrollListener = () => {
      console.log('Setting up scroll listener, previewActive:', previewActive)
      if (previewActive) {
        // In preview mode, listen to preview container scroll
        const previewContainer = document.getElementById('preview-overlay-scroll')
        if (previewContainer) {
          console.log('Attaching scroll listener to preview container')
          previewContainer.addEventListener('scroll', handleScroll, { passive: true })
          return () => {
            console.log('Removing scroll listener from preview container')
            previewContainer.removeEventListener('scroll', handleScroll)
          }
        } else {
          console.log('Preview container not found, retrying in 100ms')
          // Retry after a short delay if container not found
          const timeoutId = setTimeout(setupScrollListener, 100)
          return () => clearTimeout(timeoutId)
        }
      } else {
        console.log('Attaching scroll listener to window')
        // In normal mode, listen to window scroll
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => {
          console.log('Removing scroll listener from window')
          window.removeEventListener('scroll', handleScroll)
        }
      }
    }

    return setupScrollListener()
  }, [previewActive])

  // Sequential pattern state for instant generation when detected
  const [sequentialPattern, setSequentialPattern] = useState<{ basePath: string; extension: string; pad: number } | null>(null)
  const [lastPageUrl, setLastPageUrl] = useState<string | null>(null)

  // New: scraping method and sticky arrows toggle
  const [scrapingMethod, setScrapingMethod] = useState<'smart' | 'fast'>('smart')
  const [stickyArrowsEnabled, setStickyArrowsEnabled] = useState<boolean>(true)
  const [showScrollButtons, setShowScrollButtons] = useState<boolean>(true)
  const [consecutiveMissThreshold, setConsecutiveMissThreshold] = useState<number>(3)
  const [chapterCount, setChapterCount] = useState<number>(1)
  const [validateImages, setValidateImages] = useState<boolean>(false)
  // Tooltip open states for info buttons
  const [smartInfoOpen, setSmartInfoOpen] = useState<boolean>(false)
  const [fastInfoOpen, setFastInfoOpen] = useState<boolean>(false)
  const [navInfoOpen, setNavInfoOpen] = useState<boolean>(false)
  const [missInfoOpen, setMissInfoOpen] = useState<boolean>(false)
  const [chapterInfoOpen, setChapterInfoOpen] = useState<boolean>(false)
  const [validateInfoOpen, setValidateInfoOpen] = useState<boolean>(false)

  const availableFileTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico']

  const handleFileTypeToggle = (type: string) => {
    setFileTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const handleScrape = async () => {
    await handleScrapeWithUrl()
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

  const generateSequentialScrapedImages = (basePath: string, extension: string, pad: number, count = 50) => {
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

  // Schedule a scroll-to-top action (scrolls container/window but avoids clicking buttons that might interfere with preview mode)
  const scheduleUpArrow = (delay = 500) => {
    if (typeof window === 'undefined') return
    try {
      if (upArrowClickTimeoutRef.current) {
        window.clearTimeout(upArrowClickTimeoutRef.current)
      }
    } catch (e) {
      // ignore
    }

    upArrowClickTimeoutRef.current = window.setTimeout(() => {
      try {
        // First check if we're in preview mode and scroll the preview container
        const previewEl = document.getElementById('preview-overlay-scroll')
        if (previewEl) {
          previewEl.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          // Only try to find scroll buttons if not in preview mode to avoid interfering with preview state
          const nodes = Array.from(document.querySelectorAll('button[title="Scroll to top"]')) as HTMLButtonElement[]
          let btn: HTMLButtonElement | undefined = nodes.find(b => b.offsetParent !== null && (b as HTMLElement).clientHeight > 0)
          if (!btn && nodes.length > 0) btn = nodes[0]
          if (btn) {
            try { btn.click() } catch (e) { /* ignore */ }
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }
        }
      } catch (err) {
        // final fallback
        try {
          const previewEl = document.getElementById('preview-overlay-scroll')
          if (previewEl) previewEl.scrollTo({ top: 0, behavior: 'smooth' })
          else window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (e) { /* ignore */ }
      }
    }, delay)
  }

  const handleChapterNavigation = async (direction: 'prev' | 'next') => {
    // Generate URL for the target chapter (single chapter navigation)
    let targetUrl = url
    const chapterInfo = parseChapterFromUrl(url)
    
    if (!chapterInfo.hasChapter) return
    
    // Calculate the target chapter number (single increment/decrement)
    const increment = direction === 'next' ? 1 : -1
    const targetChapterNumber = chapterInfo.chapterNumber + increment
    
    // Don't allow negative chapter numbers
    if (targetChapterNumber < 0) return
    
    // Generate URL for the target chapter
    try {
      const urlObj = new URL(url)
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0)
      
      // Find and replace the chapter segment
      for (let i = pathSegments.length - 1; i >= 0; i--) {
        const segment = pathSegments[i]
        
        if (segment === chapterInfo.chapterSegment) {
          // Determine the new segment format based on the original
          const chapterMatch = segment.match(/^(chapter|ch|episode|ep|part|p)[-_]?(\d+)$/i)
          if (chapterMatch) {
            const prefix = chapterMatch[1]
            const separator = segment.includes('-') ? '-' : (segment.includes('_') ? '_' : '')
            pathSegments[i] = `${prefix}${separator}${targetChapterNumber}`
          } else if (segment.match(/^\d+$/)) {
            pathSegments[i] = targetChapterNumber.toString()
          }
          break
        }
      }
      
      // Reconstruct the URL
      urlObj.pathname = '/' + pathSegments.join('/') + (url.endsWith('/') ? '/' : '')
      targetUrl = urlObj.toString()
    } catch (error) {
      return
    }

    // If we have a sequential pattern detected from previous scrape, assume same structure in next chapters
    if (sequentialPattern && lastPageUrl) {
      const oldChapterInfo = parseChapterFromUrl(lastPageUrl)
      const newChapterInfo = parseChapterFromUrl(targetUrl)
      if (oldChapterInfo.hasChapter && newChapterInfo.hasChapter) {
        const oldSeg = oldChapterInfo.chapterSegment
        const newSeg = newChapterInfo.chapterSegment
        let newBase = sequentialPattern.basePath
        if (!newBase.endsWith('/')) newBase = newBase + '/'
        if (oldSeg && newSeg && newBase.includes(oldSeg)) {
          // Generate images for multiple chapters
          const allImages: ScrapedImage[] = []
          for (let i = 0; i < chapterCount; i++) {
            const chapterNum = targetChapterNumber + i
            const chapterSegment = newSeg.replace(targetChapterNumber.toString(), chapterNum.toString())
            const chapterBase = newBase.replace(oldSeg + '/', chapterSegment + '/')
            const chapterImages = generateSequentialScrapedImages(chapterBase, sequentialPattern.extension, sequentialPattern.pad, 50)
            // Add chapter info to alt text
            chapterImages.forEach(img => {
              img.alt = `Image from ${new URL(targetUrl).hostname} - Chapter ${chapterNum}`
            })
            allImages.push(...chapterImages)
          }
          
          setImages(allImages)
          setStats({ total: allImages.length, duplicates: 0, filtered: allImages.length })
          setUrl(targetUrl)
          setLastPageUrl(targetUrl)
          setSequentialPattern({ basePath: newBase.replace(oldSeg + '/', newSeg + '/'), extension: sequentialPattern.extension, pad: sequentialPattern.pad })
          return
        }
      }
    }

    // Fallback: perform a normal scrape on the new URL
    setUrl(targetUrl)

    // Start the scrape for the target URL
    handleScrapeWithUrl(targetUrl)
  }

  // Progress handler that supports live insertion of images reported by the scraper
  const handleProgress = useCallback((p: ScrapeProgress) => {
    setProgress(p)
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
        validateImages
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
        const found = Math.max(scrapedImages.length, images.length)
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
                <ImageIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Image Viewer</h1>
                <p className="text-muted-foreground">Extract all images from any website simple as fast!</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <a href="https://github.com/zebbern" target="_blank" rel="noopener noreferrer" title="zebbern on GitHub" className="rounded-full overflow-hidden w-10 h-10 border border-border hover:shadow-md">
                <img src="https://github.com/zebbern.png" alt="zebbern" className="w-full h-full object-cover" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Controls */}
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 mb-8">
          {/* URL Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Website URL
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                (Works best with manga/comic sites and image galleries)
              </span>
            </label>

            {/* Navigation arrows and chapter controls - each on its own left-aligned line */}
            {(() => {
              const navState = getNavigationState(url)
              const chapterInfo = parseChapterFromUrl(url)
              return chapterInfo.hasChapter ? (
                <div className="mb-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleChapterNavigation('prev')}
                      disabled={!navState.canGoPrev || isLoading}
                      className={`p-3 rounded-lg border transition-colors flex items-center justify-center ${
                        navState.canGoPrev && !isLoading
                          ? 'bg-card border-border hover:bg-accent text-foreground'
                          : 'bg-muted border-muted text-muted-foreground cursor-not-allowed'
                      }`}
                      title={`Previous chapter (${chapterInfo.chapterNumber - 1})`}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    <Tooltip open={navInfoOpen} onOpenChange={setNavInfoOpen}>
                      <TooltipTrigger asChild>
                        <button onClick={() => setNavInfoOpen(prev => !prev)} className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Navigation info">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Use the chapter navigation buttons to jump between detected chapters. The scraper will fetch the specified number of chapters per click.
                      </TooltipContent>
                    </Tooltip>

                    <div className="flex-1" />

                    <button
                      onClick={() => handleChapterNavigation('next')}
                      disabled={!navState.canGoNext || isLoading}
                      className={`p-3 rounded-lg border transition-colors flex items-center justify-center ${
                        navState.canGoNext && !isLoading
                          ? 'bg-card border-border hover:bg-accent text-foreground'
                          : 'bg-muted border-muted text-muted-foreground cursor-not-allowed'
                      }`}
                      title={`Next chapter (${chapterInfo.chapterNumber + 1})`}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : null
            })()}

            <div className="relative mb-3">
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

            <div className="mb-3">
              {!isLoading ? (
                <button
                  onClick={handleScrape}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center justify-center"
                  aria-label="Scrape Images"
                >
                  <Search className="h-5 w-5" />
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="px-6 py-3 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors font-medium flex items-center space-x-2"
                >
                  <span>Stop</span>
                </button>
              )}
            </div>

            {/* Chapter Info Display */}
            {(() => {
              const chapterInfo = parseChapterFromUrl(url)
              return chapterInfo.hasChapter ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  <div>📖</div>
                  <div>Chapter {chapterInfo.chapterNumber} detected - Will fetch {chapterCount} chapter(s) per navigation</div>
                </div>
              ) : null
            })()}
          </div>

          {/* File Type Filters and Options */}
          <div className="mb-6">
            {/* Scraping method selector and sticky arrows toggle - each on its own left-aligned line */}
            <div className="space-y-3">
              <div className="flex items-start space-x-4">
                <div className="text-sm text-muted-foreground mt-1 w-24 flex-shrink-0">Method:</div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2 bg-input border border-border rounded-md px-2 py-1">
                    <button
                      onClick={() => setScrapingMethod('smart')}
                      className={`px-3 py-1 text-sm rounded-md border ${scrapingMethod === 'smart' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-transparent text-foreground hover:border-primary/70'}`}
                      disabled={isLoading}
                      aria-label="Smart"
                    >
                      Smart
                    </button>

                    <button
                      onClick={() => setScrapingMethod('fast')}
                      className={`px-3 py-1 text-sm rounded-md border ${scrapingMethod === 'fast' ? 'bg-primary text-primary-foreground border-primary' : 'bg-transparent border-transparent text-foreground hover:border-primary/70'}`}
                      disabled={isLoading}
                      aria-label="Fast"
                    >
                      Fast
                    </button>

                    <Tooltip open={smartInfoOpen || fastInfoOpen} onOpenChange={(open) => { setSmartInfoOpen(open); setFastInfoOpen(open); }}>
                      <TooltipTrigger asChild>
                        <button onClick={() => { setSmartInfoOpen(prev => !prev); setFastInfoOpen(prev => !prev); }} className="ml-2 w-6 h-6 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Method info">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">Smart: runs thorough DOM + JS detection. Fast: assumes sequential filenames and generates image URLs quickly.</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">Miss:</div>
                <div className="relative">
                  <select
                    value={consecutiveMissThreshold}
                    onChange={(e) => setConsecutiveMissThreshold(Number(e.target.value))}
                    className="pl-3 pr-10 py-1 text-sm bg-input border border-border rounded-md text-foreground appearance-none"
                    disabled={isLoading}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>

                  <Tooltip open={missInfoOpen} onOpenChange={setMissInfoOpen}>
                    <TooltipTrigger asChild>
                      <button onClick={() => setMissInfoOpen(prev => !prev)} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Miss info">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Number of consecutive missed requests before the scraper stops trying sequential generation. Increase to be more tolerant of gaps.</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">Chapters:</div>
                <div className="relative">
                  <select
                    value={chapterCount}
                    onChange={(e) => setChapterCount(Number(e.target.value))}
                    className="pl-3 pr-10 py-1 text-sm bg-input border border-border rounded-md text-foreground appearance-none"
                    disabled={isLoading}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                    <option value={6}>6</option>
                    <option value={7}>7</option>
                    <option value={8}>8</option>
                    <option value={9}>9</option>
                    <option value={10}>10</option>
                  </select>

                  <Tooltip open={chapterInfoOpen} onOpenChange={setChapterInfoOpen}>
                    <TooltipTrigger asChild>
                      <button onClick={() => setChapterInfoOpen(prev => !prev)} className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Chapters info">
                        <Info className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Number of chapters to fetch in a single action when navigating. Use higher values to batch multiple chapters at once.</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Image Validation Toggle */}
              <div className="flex items-center space-x-3">
                <div className="text-sm text-muted-foreground w-24 flex-shrink-0">Validation:</div>
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    id="validateImages"
                    checked={validateImages}
                    onChange={(e) => setValidateImages(e.target.checked)}
                    className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary focus:ring-2"
                    disabled={isLoading}
                  />
                  <label htmlFor="validateImages" className="ml-2 text-sm text-foreground cursor-pointer">
                    Validate images
                  </label>
                  
                  <Tooltip open={validateInfoOpen} onOpenChange={setValidateInfoOpen}>
                    <TooltipTrigger asChild>
                      <button onClick={() => setValidateInfoOpen(prev => !prev)} className="ml-2 w-4 h-4 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" aria-label="Validation info">
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

              <div>
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
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
                  <span className="text-muted-foreground whitespace-nowrap">Sticky arrows</span>
                </label>
              </div>

              <div>
                <label className="flex items-center space-x-2 text-sm cursor-pointer">
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
                  <span className="text-muted-foreground whitespace-nowrap">Scroll buttons</span>
                </label>
              </div>
            </div>

            <div className="h-3" />

            <div className="mb-3">
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">File Types ({fileTypes.length} selected)</label>
              </div>
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
          <ImageGallery images={images} websiteUrl={url} onImageError={handleRemoveImageOnError} onPreviewChange={setPreviewActive} showScrollButtons={showScrollButtons} />
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
                onClick={() => { handleChapterNavigation('prev'); scheduleUpArrow(1000); }}
                disabled={!navState.canGoPrev || isLoading}
                className={`p-2.5 rounded-full border transition-colors flex items-center justify-center ${
                  navState.canGoPrev && !isLoading
                    ? 'bg-card/80 border-border/60 hover:bg-accent text-foreground'
                    : 'bg-muted/60 border-muted text-muted-foreground cursor-not-allowed'
                }`}
                title={`Previous chapter`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => { handleChapterNavigation('next'); scheduleUpArrow(500); }}
                disabled={!navState.canGoNext || isLoading}
                className={`p-2.5 rounded-full border transition-colors flex items-center justify-center ${
                  navState.canGoNext && !isLoading
                    ? 'bg-card/80 border-border/60 hover:bg-accent text-foreground'
                    : 'bg-muted/60 border-muted text-muted-foreground cursor-not-allowed'
                }`}
                title={`Next chapter`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default ImageScraper
