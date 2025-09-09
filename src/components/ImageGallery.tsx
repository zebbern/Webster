import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Download, Eye, Copy, Check, Grid, Maximize, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { ScrapedImage } from '../utils/advancedImageScraper'
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
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, websiteUrl = '', onImageError, onPreviewChange, onButtonVisibilityChange, showScrollButtons = false, initialPreviewMode = false, onNextChapter, onManualNextChapter, onStartNavigation, onPreviousChapter, currentChapter, canAutoNavigate = true, isNavigating = false }) => {
  const [selectedImage, setSelectedImage] = useState<ScrapedImage | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [exportingHTML, setExportingHTML] = useState(false)
  const [previewMode, setPreviewMode] = useState(initialPreviewMode)
  const [buttonsVisible, setButtonsVisible] = useState<boolean>(true)
  const [lastScrollY, setLastScrollY] = useState<number>(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
      setButtonsVisible(true)
      setLastScrollY(0)
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

  // Ultra-gentle scroll management that preserves mobile browser behavior
  useEffect(() => {
    if (previewMode) {
      // Store current scroll position
      const scrollY = window.scrollY
      
      // Use overscroll-behavior instead of overflow hidden - much gentler approach
      document.body.style.overscrollBehavior = 'none'
      document.body.style.height = '100%'
      
      // Disable custom scrollbars in preview mode - use native browser scrollbars
      const style = document.createElement('style')
      style.id = 'preview-scrollbar-override'
      style.textContent = `
        .fixed.inset-0 ::-webkit-scrollbar {
          width: auto !important;
          height: auto !important;
        }
        .fixed.inset-0 ::-webkit-scrollbar-track {
          background: transparent !important;
        }
        .fixed.inset-0 ::-webkit-scrollbar-thumb {
          background: transparent !important;
        }
        .fixed.inset-0 * {
          scrollbar-width: auto !important;
        }
      `
      document.head.appendChild(style)
      
      return () => {
        // Restore body styles
        document.body.style.overscrollBehavior = ''
        document.body.style.height = ''
        
        // Remove scrollbar override
        const styleElement = document.getElementById('preview-scrollbar-override')
        if (styleElement) {
          document.head.removeChild(styleElement)
        }
        
        // Restore scroll position
        window.scrollTo(0, scrollY)
      }
    }
  }, [previewMode])


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

  // Throttled scroll handler to improve performance
  const handleScrollThrottled = useCallback(() => {
    const previewContainer = document.getElementById('preview-overlay-scroll')
    if (!previewContainer) return

    const currentScrollY = previewContainer.scrollTop
    const containerHeight = previewContainer.clientHeight
    const scrollHeight = previewContainer.scrollHeight
    
    // More strict bottom detection - only trigger when very close to bottom
    const isAtBottom = currentScrollY + containerHeight >= scrollHeight - THRESHOLDS.BOTTOM_SCROLL_THRESHOLD
    
    // Only consider "at bottom" if we've scrolled a significant amount
    const hasScrolledSignificantly = currentScrollY > containerHeight * THRESHOLDS.SCROLL_PERCENTAGE_THRESHOLD

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
  }, [lastScrollY, onButtonVisibilityChange])

  // Scroll detection for button visibility in preview mode
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

    const previewContainer = document.getElementById('preview-overlay-scroll')
    if (previewContainer) {
      previewContainer.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        previewContainer.removeEventListener('scroll', handleScroll)
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
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
    if (previewMode) {
      const el = document.getElementById('preview-overlay-scroll')
      if (el) {
        el.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    if (previewMode) {
      const el = document.getElementById('preview-overlay-scroll')
      if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
        return
      }
    }
    const bottom = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    window.scrollTo({ top: bottom, behavior: 'smooth' })
  }


  // Preview mode - full window with no spacing
  if (previewMode) {
    return (
      <div 
        className="fixed inset-0 z-40 bg-black"
        style={{
          // Explicitly tell mobile browsers to allow normal touch interactions  
          touchAction: 'manipulation',
        }}
      >
        {/* Exit button */}
        <button
          onClick={() => setPreviewMode(false)}
          className={`fixed top-4 right-4 z-50 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all duration-300 ${
            buttonsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          title="Exit preview mode"
        >
          <Grid className="h-5 w-5" />
        </button>
        
        {/* Scroll to top/bottom buttons (placed near bottom of preview) */}
        {showScrollButtons && (
        <div className={`fixed right-4 bottom-6 z-50 flex flex-col items-end space-y-2 transition-all duration-300 ${
          buttonsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex flex-col space-y-2">
            <button
              onClick={scrollToTop}
              className="p-2.5 bg-card/90 text-foreground rounded-full hover:bg-card transition-colors shadow-lg"
              title="Scroll to top"
            >
              <ChevronUp className="h-5 w-5" />
            </button>
            <button
              onClick={scrollToBottom}
              className="p-2.5 bg-card/90 text-foreground rounded-full hover:bg-card transition-colors shadow-lg"
              title="Scroll to bottom"
            >
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>
        </div>
        )}

        {/* Chapter navigation buttons */}
        {(onPreviousChapter || onNextChapter) && (
        <div className={`fixed left-4 bottom-6 z-50 flex flex-col items-start space-y-2 transition-all duration-300 ${
          buttonsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="flex items-center space-x-2">
            {onPreviousChapter && (
              <button
                onClick={onPreviousChapter}
                className="p-2.5 bg-card/90 text-foreground rounded-full hover:bg-card transition-colors shadow-lg"
                title="Previous chapter"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            
            {currentChapter && (
              <div className="px-3 py-2 bg-card/90 text-foreground rounded-lg shadow-lg">
                <span className="text-sm font-medium">Chapter {currentChapter}</span>
              </div>
            )}
            
            {(onManualNextChapter || onNextChapter) && (
              <button
                onClick={onManualNextChapter || onNextChapter}
                className="p-2.5 bg-card/90 text-foreground rounded-full hover:bg-card transition-colors shadow-lg"
                title="Next chapter"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
        )}


        {/* Images with no spacing */}
        <div 
          id="preview-overlay-scroll" 
          className="h-full overflow-y-auto"
          style={{
            // Mobile-friendly scrolling with proper touch support
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            // Basic containment without breaking mobile browser behavior
            contain: 'layout style',
            // Explicitly allow all touch gestures for mobile browser UI detection
            touchAction: 'auto',
          }}
        >
          {images.length === 0 && (initialPreviewMode || isNavigating) ? (
            // Show loading placeholder when preserving preview mode during chapter navigation or auto navigation
            <div 
              className="w-full flex items-center justify-center" 
              style={{ 
                height: '100vh', 
                backgroundColor: 'transparent',
                display: 'flex'
              }}
            >
              {isNavigating && (
                <div className="flex flex-col items-center space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-accent" />
                  <p className="text-muted-foreground">Loading next chapter...</p>
                </div>
              )}
            </div>
          ) : (
            images.map((image, index) => (
              <img
                key={`preview-${image.url}-${index}`}
                src={image.url}
                alt={image.alt || `Image ${index + 1}`}
                className="w-full block"
                style={{ 
                  display: 'block', 
                  margin: 0, 
                  padding: 0,
                  width: '100%',
                  height: 'auto'
                }}
                loading="lazy"
                decoding="async"
                onError={() => onImageError?.(image.url)}
              />
            ))
          )}
        </div>
      </div>
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
