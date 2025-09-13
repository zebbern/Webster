import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Download, Eye, Copy, Check, Grid, Maximize, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2, Play, Pause, FastForward, RotateCcw } from 'lucide-react'
import { ScrapedImage, preloadNextChapterImages } from '../utils/advancedImageScraper'
import { downloadImage, downloadAllImages } from '../utils/downloadUtils'
import { copyToClipboard } from '../utils/clipboardUtils'
import ImageModal from './ImageModal'
import { downloadHTMLExport } from '../utils/htmlExporter'
// Removed useBodyScrollLock import - no longer preventing body scroll in preview mode
import { TIMING, THRESHOLDS, UI_CONFIG } from '../constants'

interface ImageGalleryProps {
  images: ScrapedImage[]
  websiteUrl?: string
  onImageError?: (url: string) => void
  onPreviewChange?: (active: boolean) => void
  onButtonVisibilityChange?: (visible: boolean) => void
  showScrollButtons?: boolean
  initialPreviewMode?: boolean
  onNextChapter?: () => void
  onManualNextChapter?: () => void
  onStartNavigation?: () => void
  onPreviousChapter?: () => void
  currentChapter?: number
  canAutoNavigate?: boolean
  isNavigating?: boolean
  backgroundPreloading?: boolean
  fileTypes?: string[]
  validateImages?: boolean
  autoScroll?: boolean
  autoScrollSpeed?: number
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, websiteUrl = '', onImageError, onPreviewChange, onButtonVisibilityChange, showScrollButtons = false, initialPreviewMode = false, onNextChapter, onManualNextChapter, onStartNavigation, onPreviousChapter, currentChapter, canAutoNavigate = true, isNavigating = false, backgroundPreloading = false, fileTypes = [], validateImages = false, autoScroll = false, autoScrollSpeed = 2 }) => {
  const [selectedImage, setSelectedImage] = useState<ScrapedImage | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [exportingHTML, setExportingHTML] = useState(false)
  const [previewMode, setPreviewMode] = useState(initialPreviewMode)
  const [buttonsVisible, setButtonsVisible] = useState<boolean>(true)
  const [lastScrollY, setLastScrollY] = useState<number>(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false)
  const [currentSpeed, setCurrentSpeed] = useState<number>(1.5) // Default moderate speed
  const autoScrollRef = useRef<number | null>(null)
  const [showSpeedSelector, setShowSpeedSelector] = useState<boolean>(false)
  const lastScrollTopRef = useRef<number>(0)
  const scrollInterferenceRef = useRef<NodeJS.Timeout | null>(null)

  // Generate speed options from 0x to 2x in 0.1x increments
  const speedOptions = Array.from({ length: 21 }, (_, i) => ({
    value: i * 0.1,
    label: `${(i * 0.1).toFixed(1)}x`
  }))

  // Handle bottom-left corner clicks to show speed selector
  const handleDocumentClick = useCallback((e: MouseEvent) => {
    if (!previewMode) return
    
    const cornerSize = 50 // 50px corner area
    const isBottomLeftCorner = e.clientX < cornerSize && 
                              e.clientY > window.innerHeight - cornerSize
    
    if (isBottomLeftCorner) {
      setShowSpeedSelector(prev => !prev)
      e.preventDefault()
      e.stopPropagation()
    } else if (showSpeedSelector) {
      // Hide speed selector when clicking elsewhere
      setShowSpeedSelector(false)
    }
  }, [previewMode, showSpeedSelector])

  // Add document click listener for bottom-left corner detection
  useEffect(() => {
    if (previewMode) {
      document.addEventListener('click', handleDocumentClick, true)
      return () => document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [previewMode, handleDocumentClick])

  useEffect(() => {
    onPreviewChange?.(previewMode)
  }, [previewMode, onPreviewChange])

  // Update preview mode when initialPreviewMode changes
  useEffect(() => {
    setPreviewMode(initialPreviewMode)
    // Reset button visibility when entering preview mode
    if (initialPreviewMode) {
      setButtonsVisible(true)
      setLastScrollY(0)
    }
  }, [initialPreviewMode])

  // Reset button visibility when new images load (after navigation)
  useEffect(() => {
    if (previewMode && images.length > 0) {
      // Force button visibility with a small delay to override any scroll handler conflicts
      setButtonsVisible(true)
      setLastScrollY(0)
      
      // Additional safety: ensure buttons remain visible after scroll handlers initialize
      const safetyTimer = setTimeout(() => {
        setButtonsVisible(true)
      }, 150)
      
      return () => clearTimeout(safetyTimer)
    }
  }, [images.length, previewMode])


  // Simple scroll to top when entering preview mode
  useEffect(() => {
    if (previewMode && images.length > 0 && !isNavigating) {
      const previewContainer = document.getElementById('preview-overlay-scroll')
      if (previewContainer) {
        setTimeout(() => {
          if (!isNavigating) {
            // Simply scroll to top - let natural mobile browser behavior handle the rest
            previewContainer.scrollTo({ top: 0, behavior: 'instant' })
          }
        }, TIMING.PREVIEW_REFRESH_DELAY)
      }
    }
  }, [previewMode, isNavigating])

  // Clean up scroll state when exiting preview mode
  useEffect(() => {
    if (!previewMode) {
      setLastScrollY(0)
      setButtonsVisible(true)
    }
  }, [previewMode])

  // Document-level Preview mode that preserves mobile browser behavior
  useEffect(() => {
    if (previewMode) {
      // Store current scroll position
      const scrollY = window.scrollY
      
      // Apply black background to body and remove margins/padding for full-width images
      const originalBackground = document.body.style.backgroundColor
      const originalColor = document.body.style.color
      const originalMargin = document.body.style.margin
      const originalPadding = document.body.style.padding
      
      document.body.style.backgroundColor = 'black'
      document.body.style.color = 'white'
      document.body.style.margin = '0'
      document.body.style.padding = '0'
      
      // Hide the main app container completely
      const rootElement = document.getElementById('root')
      const originalRootDisplay = rootElement?.style.display
      if (rootElement) {
        rootElement.style.display = 'none'
      }
      
      // Hide sticky header by finding it in the DOM
      const headerElement = document.querySelector('header')
      const originalHeaderDisplay = headerElement?.style.display
      if (headerElement) {
        (headerElement as HTMLElement).style.display = 'none'
      }
      
      return () => {
        // Restore body styles
        document.body.style.backgroundColor = originalBackground
        document.body.style.color = originalColor
        document.body.style.margin = originalMargin
        document.body.style.padding = originalPadding
        
        // Show the main app container
        if (rootElement) {
          rootElement.style.display = originalRootDisplay || ''
        }
        
        // Show header
        if (headerElement) {
          (headerElement as HTMLElement).style.display = originalHeaderDisplay || ''
        }
        
        // Restore scroll position
        window.scrollTo(0, scrollY)
      }
    }
  }, [previewMode])

  // Background preloading for next chapter when in preview mode
  useEffect(() => {
    if (!previewMode || !backgroundPreloading || !websiteUrl || images.length === 0) {
      return
    }

    // Add a small delay to let the current chapter load completely
    const preloadTimer = setTimeout(() => {
      preloadNextChapterImages(websiteUrl, fileTypes, {
        validateImages,
        maxPreloadImages: 15 // Limit to avoid excessive network usage
      }).catch(() => {
        // Silently ignore preload failures
      })
    }, 3000) // 3 second delay after preview mode starts

    return () => clearTimeout(preloadTimer)
  }, [previewMode, backgroundPreloading, websiteUrl, images.length, fileTypes, validateImages])

  // Keyboard navigation for preview mode
  useEffect(() => {
    if (!previewMode) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        // Scroll to next/previous image
        const direction = e.key === 'ArrowLeft' ? -1 : 1
        const currentScroll = window.scrollY
        const imageHeight = window.innerHeight
        const targetScroll = Math.max(0, currentScroll + (direction * imageHeight))
        window.scrollTo({ top: targetScroll, behavior: 'smooth' })
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setPreviewMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewMode])

  // Auto scroll functionality
  const startAutoScroll = useCallback(() => {
    if (!previewMode || currentSpeed <= 0) return
    
    // Stop any existing animation
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
    
    setIsAutoScrolling(true)
    
    const scroll = () => {
      // Much slower speed calculation for comfortable reading
      // 0.1x = 0.18px, 0.2x = 0.36px, 0.3x = 0.54px, 1.0x = 1.8px, 3.0x = 5.4px
      const baseSpeed = 1.8
      const scrollAmount = baseSpeed * currentSpeed
      
      window.scrollBy({ top: scrollAmount, behavior: 'auto' })
      lastScrollTopRef.current = window.scrollY
      
      // Continue scrolling
      autoScrollRef.current = requestAnimationFrame(scroll)
    }
    
    autoScrollRef.current = requestAnimationFrame(scroll)
  }, [previewMode, currentSpeed])

  const stopAutoScroll = useCallback(() => {
    setIsAutoScrolling(false)
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current)
      autoScrollRef.current = null
    }
    if (scrollInterferenceRef.current) {
      clearTimeout(scrollInterferenceRef.current)
      scrollInterferenceRef.current = null
    }
  }, [])

  const toggleAutoScroll = useCallback(() => {
    if (isAutoScrolling) {
      stopAutoScroll()
    } else {
      startAutoScroll()
    }
  }, [isAutoScrolling, startAutoScroll, stopAutoScroll])

  const changeSpeed = useCallback((newSpeed: number) => {
    setCurrentSpeed(Math.max(0, Math.min(2, newSpeed))) // Allow 0x to 2x speed
  }, [])

  const handleSpeedSelect = useCallback((speed: number) => {
    changeSpeed(speed)
    setShowSpeedSelector(false)
    
    // If speed is 0, stop auto-scroll, otherwise start it if not running
    if (speed === 0) {
      setIsAutoScrolling(false)
    } else if (!isAutoScrolling && previewMode) {
      setIsAutoScrolling(true)
    }
  }, [changeSpeed, isAutoScrolling, previewMode])

  // Auto scroll cleanup effect
  useEffect(() => {
    return () => {
      if (autoScrollRef.current) {
        cancelAnimationFrame(autoScrollRef.current)
        autoScrollRef.current = null
      }
    }
  }, [])

  // Update speed when prop changes
  useEffect(() => {
    setCurrentSpeed(autoScrollSpeed)
  }, [autoScrollSpeed])

  // Clean up auto scroll when leaving preview mode
  useEffect(() => {
    if (!previewMode) {
      stopAutoScroll()
    }
  }, [previewMode, stopAutoScroll])

  // Scroll and touch interference detection
  useEffect(() => {
    if (!previewMode || !isAutoScrolling) return

    let userInteracted = false
    let lastAutoScrollY = window.scrollY

    const handleUserInteraction = () => {
      userInteracted = true
      stopAutoScroll()
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const scrollDiff = Math.abs(currentScrollY - lastAutoScrollY)
      
      // If scroll difference is significantly larger than expected auto-scroll amount
      // Using new speed calculation: 1.8 * currentSpeed
      const expectedScrollAmount = 1.8 * currentSpeed
      if (scrollDiff > expectedScrollAmount * 6) {
        userInteracted = true
        stopAutoScroll()
        return
      }
      
      // Update last auto-scroll position
      lastAutoScrollY = currentScrollY
    }

    // Add multiple event listeners for user interaction
    window.addEventListener('touchstart', handleUserInteraction, { passive: true })
    window.addEventListener('touchmove', handleUserInteraction, { passive: true })
    window.addEventListener('wheel', handleUserInteraction, { passive: true })
    window.addEventListener('mousedown', handleUserInteraction, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      window.removeEventListener('touchstart', handleUserInteraction)
      window.removeEventListener('touchmove', handleUserInteraction)
      window.removeEventListener('wheel', handleUserInteraction)
      window.removeEventListener('mousedown', handleUserInteraction)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [previewMode, isAutoScrolling, currentSpeed, stopAutoScroll])

  // Throttled scroll handler using document-level scrolling
  const handleScrollThrottled = useCallback(() => {
    if (!previewMode) return
    
    const currentScrollY = window.scrollY
    const windowHeight = window.innerHeight
    const documentHeight = document.documentElement.scrollHeight
    
    // More strict bottom detection - only trigger when very close to bottom
    const isAtBottom = currentScrollY + windowHeight >= documentHeight - THRESHOLDS.BOTTOM_SCROLL_THRESHOLD
    
    // Only consider "at bottom" if we've scrolled a significant amount
    const hasScrolledSignificantly = currentScrollY > windowHeight * THRESHOLDS.SCROLL_PERCENTAGE_THRESHOLD

    // Show buttons when:
    // 1. Scrolling up (currentScrollY < lastScrollY)
    // 2. At the bottom of the page
    // 3. At the very top
    if (currentScrollY < lastScrollY || isAtBottom || currentScrollY < THRESHOLDS.TOP_SCROLL_THRESHOLD) {
      setButtonsVisible(true)
      onButtonVisibilityChange?.(true)
    } else if (currentScrollY > lastScrollY) {
      // Hide buttons when scrolling down
      setButtonsVisible(false)
      onButtonVisibilityChange?.(false)
    }

    setLastScrollY(currentScrollY)
  }, [lastScrollY, onButtonVisibilityChange, previewMode])

  // Document-level scroll detection for button visibility in preview mode
  useEffect(() => {
    if (!previewMode) return

    const handleScroll = () => {
      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
      
      // Reduce throttling to improve responsiveness
      scrollTimeoutRef.current = setTimeout(handleScrollThrottled, TIMING.SCROLL_THROTTLE_INTERVAL)
    }

    // Use window scroll events for document-level scroll detection
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [previewMode, handleScrollThrottled])

  const handleCopyUrl = async (url: string) => {
    const success = await copyToClipboard(url)
    if (success) {
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    }
  }

  const handleDownloadAll = async () => {
    setDownloadingAll(true)
    try {
      await downloadAllImages(images)
    } catch (err) {
      console.error('Failed to download images:', err)
      alert('Failed to download images. Some images may not be accessible due to CORS restrictions.')
    } finally {
      setDownloadingAll(false)
    }
  }

  const handleHTMLExport = async () => {
    setExportingHTML(true)
    try {
      // Export the HTML matching preview when previewMode is active
      downloadHTMLExport(images, websiteUrl)
    } catch (err) {
      console.error('Failed to export HTML:', err)
      alert('Failed to export HTML file.')
    } finally {
      setExportingHTML(false)
    }
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return '—'
    const k = UI_CONFIG.BYTES_IN_KILOBYTE
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    const bottom = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    window.scrollTo({ top: bottom, behavior: 'smooth' })
  }


  // Preview mode - render directly to document body using Portal
  if (previewMode) {
    return createPortal(
      <div 
        style={{
          backgroundColor: 'black',
          margin: 0,
          padding: 0,
          width: '100vw',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 50
        }}
      >
        {/* Fixed UI Controls */}
        {/* Simple Auto Scroll Button - Always visible in bottom left */}
        <div className={`fixed bottom-4 left-4 z-[80] transition-all duration-300 ${
          isAutoScrolling ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}>
          <div className="flex flex-col items-start space-y-2">
            {/* Speed selector dropdown */}
            <div className="relative">
              <select
                value={currentSpeed}
                onChange={(e) => setCurrentSpeed(parseFloat(e.target.value))}
                className="bg-black/70 backdrop-blur-sm text-white text-sm font-mono rounded-full px-3 py-2 border border-white/20 appearance-none cursor-pointer hover:bg-black/80 transition-colors min-w-[4rem] text-center"
              >
                {Array.from({ length: 30 }, (_, i) => {
                  const speed = (i + 1) * 0.1
                  return (
                    <option key={speed} value={speed} className="bg-black text-white">
                      {speed.toFixed(1)}x
                    </option>
                  )
                })}
              </select>
              <ChevronDown className="absolute right-1 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white/60 pointer-events-none" />
            </div>
            
            {/* Main auto-scroll toggle button */}
            <button
              onClick={toggleAutoScroll}
              className="p-3 bg-blue-500/90 hover:bg-blue-600 text-white rounded-full transition-all duration-200 shadow-lg border border-white/20 flex items-center space-x-2"
              title={`Start auto-scroll at ${currentSpeed.toFixed(1)}x speed`}
            >
              <Play className="h-5 w-5" />
              <span className="text-sm font-medium">Auto Scroll</span>
            </button>
          </div>
        </div>
        
        {/* Exit button - hidden during auto-scroll */}
        <button
          onClick={() => setPreviewMode(false)}
          className={`fixed top-4 right-4 z-[60] p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all duration-300 ${
            buttonsVisible && !isAutoScrolling ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          title="Exit preview mode"
        >
          <Grid className="h-5 w-5" />
        </button>
        
        {/* Scroll to top/bottom buttons - hidden during auto-scroll */}
        {showScrollButtons && (
        <div className={`fixed right-4 bottom-6 z-[60] flex flex-col items-end space-y-2 transition-all duration-300 ${
          buttonsVisible && !isAutoScrolling ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex flex-col space-y-2">
            <button
              onClick={scrollToTop}
              className="p-2.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors shadow-lg"
              title="Scroll to top"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-2.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors shadow-lg"
              title="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
        )}

        {/* Chapter and image count display - top left - hidden during auto-scroll */}
        <div className={`fixed top-4 left-4 z-[60] flex items-center space-x-3 transition-all duration-300 ${
          buttonsVisible && !isAutoScrolling ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {currentChapter && (
            <div className="px-4 py-2 bg-black/50 text-white rounded-lg shadow-lg">
              <span className="text-lg font-medium">Chapter {currentChapter}</span>
            </div>
          )}
          <div className="px-4 py-2 bg-black/50 text-white rounded-lg shadow-lg">
            <span className="text-lg font-medium">{images.length} Images</span>
          </div>
        </div>

        {/* Large centered chapter navigation buttons - hidden during auto-scroll */}
        {(onPreviousChapter || onNextChapter) && (
        <div className={`fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[60] flex items-center space-x-16 transition-all duration-300 ${
          buttonsVisible && !isAutoScrolling ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          {onPreviousChapter && (
            <button
              onClick={onPreviousChapter}
              className="p-6 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors shadow-lg border border-white/20"
              title="Previous chapter"
            >
              <ChevronLeft className="h-8 w-8" />
            </button>
          )}
          
          {(onManualNextChapter || onNextChapter) && (
            <button
              onClick={onManualNextChapter || onNextChapter}
              className="p-6 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors shadow-lg border border-white/20"
              title="Next chapter"
            >
              <ChevronRight className="h-8 w-8" />
            </button>
          )}
        </div>
        )}
        
        {/* Images container with document-level scrolling */}
        <div 
          style={{
            width: '100vw',
            minHeight: '100vh',
            margin: 0,
            padding: 0,
            position: 'relative'
          }}
        >
          {images.length === 0 && (initialPreviewMode || isNavigating) ? (
            // Show loading placeholder when preserving preview mode during chapter navigation
            <div 
              className="flex items-center justify-center"
              style={{ width: '100vw', height: '100vh' }}
            >
              {isNavigating && (
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-white" />
                  <p className="text-white/70">Loading next chapter...</p>
                </div>
              )}
            </div>
          ) : (
            images.map((image, index) => (
              <img
                key={`preview-${image.url}-${index}`}
                src={image.url}
                alt={image.alt || `Image ${index + 1}`}
                style={{ 
                  display: 'block', 
                  margin: 0, 
                  padding: 0,
                  width: '100vw',
                  height: 'auto',
                  maxWidth: 'none'
                }}
                loading="lazy"
                decoding="async"
                onError={() => onImageError?.(image.url)}
              />
            ))
          )}
        </div>
      </div>,
      document.body
    )
  }

  return (
    <div className="bg-card rounded-xl shadow-sm border border-border">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Found Images</h2>
            <p className="text-muted-foreground">{images.length} images ready for download</p>
          </div>
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <button
              onClick={() => setPreviewMode(true)}
              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors font-medium flex items-center space-x-2"
              title="Preview all images seamlessly"
            >
              <Maximize className="h-4 w-4" />
              <span>Preview</span>
            </button>
            <button
              onClick={handleHTMLExport}
              disabled={exportingHTML}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{exportingHTML ? 'Exporting...' : 'Export HTML'}</span>
            </button>
            <button
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="px-3 py-1.5 text-sm bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{downloadingAll ? 'Downloading...' : 'Download All'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Image Grid */}
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map((image, index) => (
            <div key={`${image.url}-${index}`} className="group relative bg-muted/50 rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={image.url}
                  alt={image.alt || `Image ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                  onError={() => {
                    // On first load error, notify parent to remove this URL so broken images don't show
                    console.warn('Failed to load image for display:', image.url)
                    onImageError?.(image.url)
                  }}
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedImage(image)}
                      className="p-2 bg-card/90 rounded-full hover:bg-card transition-colors"
                      title="Preview"
                    >
                      <Eye className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      onClick={() => downloadImage(image)}
                      className="p-2 bg-card/90 rounded-full hover:bg-card transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      onClick={() => handleCopyUrl(image.url)}
                      className="p-2 bg-card/90 rounded-full hover:bg-card transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl === image.url ? (
                        <Check className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4 text-foreground" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-foreground uppercase">
                    .{image.type}
                  </span>
                  {image.size && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(image.size)}
                    </span>
                  )}
                </div>
                {image.dimensions && (
                  <div className="text-xs text-muted-foreground mb-2">
                    {image.dimensions.width} × {image.dimensions.height}
                  </div>
                )}
                <div className="text-xs text-muted-foreground truncate" title={image.url}>
                  {new URL(image.url).pathname.split('/').pop() || 'image'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}

      {/* Floating top/bottom buttons for main gallery (placed near bottom of the page) */}
      {showScrollButtons && (
      <div className="fixed right-4 bottom-6 z-40 hidden md:flex flex-col space-y-2">
        <button
          onClick={scrollToTop}
          className="p-1 bg-card/90 text-foreground rounded-full hover:bg-card transition-colors shadow-lg"
          title="Scroll to top"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          onClick={scrollToBottom}
          className="p-1 bg-card/90 text-foreground rounded-full hover:bg-card transition-colors shadow-lg"
          title="Scroll to bottom"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>
      )}

    </div>
  )
}

export default ImageGallery
