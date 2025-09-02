import React, { useState, useEffect } from 'react'
import { Download, Eye, Copy, Check, Grid, Maximize, ChevronUp, ChevronDown, Info } from 'lucide-react'
import { ScrapedImage } from '../utils/advancedImageScraper'
import { downloadImage, downloadAllImages } from '../utils/downloadUtils'
import { copyToClipboard } from '../utils/clipboardUtils'
import ImageModal from './ImageModal'
import { downloadHTMLExport } from '../utils/htmlExporter'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'
import { getProxiedImageUrl } from '../utils/imageProxy'

interface ImageGalleryProps {
  images: ScrapedImage[]
  websiteUrl?: string
  onImageError?: (url: string) => void
  onPreviewChange?: (active: boolean) => void
  showScrollButtons?: boolean
  initialPreviewMode?: boolean
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, websiteUrl = '', onImageError, onPreviewChange, showScrollButtons = false, initialPreviewMode = false }) => {
  const [selectedImage, setSelectedImage] = useState<ScrapedImage | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [exportingHTML, setExportingHTML] = useState(false)
  const [previewMode, setPreviewMode] = useState(initialPreviewMode)
  const [buttonsVisible, setButtonsVisible] = useState<boolean>(true)
  const [lastScrollY, setLastScrollY] = useState<number>(0)

  useEffect(() => {
    onPreviewChange?.(previewMode)
  }, [previewMode, onPreviewChange])

  // Update preview mode when initialPreviewMode changes
  useEffect(() => {
    setPreviewMode(initialPreviewMode)
  }, [initialPreviewMode])

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

  // Scroll detection for button visibility in preview mode
  useEffect(() => {
    if (!previewMode) return

    const handleScroll = () => {
      const previewContainer = document.getElementById('preview-overlay-scroll')
      if (!previewContainer) return

      const currentScrollY = previewContainer.scrollTop
      const containerHeight = previewContainer.clientHeight
      const scrollHeight = previewContainer.scrollHeight
      const isAtBottom = currentScrollY + containerHeight >= scrollHeight - 10 // 10px threshold

      // Show buttons when:
      // 1. Scrolling up (currentScrollY < lastScrollY)
      // 2. At the bottom of the page
      // 3. At the very top (currentScrollY < 50)
      if (currentScrollY < lastScrollY || isAtBottom || currentScrollY < 50) {
        setButtonsVisible(true)
      } else if (currentScrollY > lastScrollY) {
        // Hide buttons when scrolling down
        setButtonsVisible(false)
      }

      setLastScrollY(currentScrollY)
    }

    const previewContainer = document.getElementById('preview-overlay-scroll')
    if (previewContainer) {
      previewContainer.addEventListener('scroll', handleScroll, { passive: true })
      return () => previewContainer.removeEventListener('scroll', handleScroll)
    }
  }, [previewMode, lastScrollY])

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
      downloadHTMLExport(images, websiteUrl, previewMode)
    } catch (err) {
      console.error('Failed to export HTML:', err)
      alert('Failed to export HTML file.')
    } finally {
      setExportingHTML(false)
    }
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes || bytes === 0) return '—'
    const k = 1024
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
      <div className="fixed inset-0 z-40 bg-black">
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

        {/* Images with no spacing */}
        <div id="preview-overlay-scroll" className="h-full overflow-y-auto">
          {images.length === 0 && initialPreviewMode ? (
            // Show transparent placeholder when preserving preview mode during chapter navigation
            <div 
              className="w-full" 
              style={{ 
                height: '100vh', 
                backgroundColor: 'transparent',
                display: 'block'
              }}
            />
          ) : (
            images.map((image, index) => (
              <img
                key={index}
                src={getProxiedImageUrl(image.url)}
                alt={image.alt || `Image ${index + 1}`}
                className="w-full block"
                style={{ display: 'block', margin: 0, padding: 0 }}
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
            <div key={index} className="group relative bg-muted/50 rounded-lg overflow-hidden border border-border hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={getProxiedImageUrl(image.url)}
                  alt={image.alt || `Image ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                  onError={(e) => {
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
