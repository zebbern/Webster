import React from 'react'
import { X, Download, ExternalLink, Copy, Check } from 'lucide-react'
import { ScrapedImage } from '../utils/advancedImageScraper'
import { downloadImage } from '../utils/downloadUtils'
import { copyToClipboard } from '../utils/clipboardUtils'
import { getProxiedImageUrl } from '../utils/imageProxy'

interface ImageModalProps {
  image: ScrapedImage
  onClose: () => void
}

const ImageModal: React.FC<ImageModalProps> = ({ image, onClose }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(image.url)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-card rounded-xl shadow-2xl max-w-4xl max-h-[90vh] overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">
              {new URL(image.url).pathname.split('/').pop() || 'Image'}
            </h3>
            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
              <span className="uppercase font-medium">.{image.type}</span>
              {image.dimensions && (
                <span>{image.dimensions.width} × {image.dimensions.height}</span>
              )}
              {image.size && (
                <span>{formatFileSize(image.size)}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Image */}
        <div className="p-4">
          <div className="flex justify-center">
            <img
              src={getProxiedImageUrl(image.url)}
              alt={image.alt || 'Preview'}
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTIwTDI0MCAyMDBIMjIwVjI0MEgxODBWMjAwSDE2MEwyMDAgMTIwWiIgZmlsbD0iIzlCOUJBMCIvPgo8dGV4dCB4PSIyMDAiIHk9IjI3MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzlCOUJBMCIgZm9udC1zaXplPSIxNiI+SW1hZ2Ugbm90IGZvdW5kPC90ZXh0Pgo8L3N2Zz4K'
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/50">
          <div className="text-sm text-muted-foreground truncate flex-1 mr-4">
            <span className="font-medium">URL:</span> {image.url}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCopyUrl}
              className="px-3 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors flex items-center space-x-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-accent" />
                  <span className="text-accent">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
            <a
              href={image.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors flex items-center space-x-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>Open</span>
            </a>
            <button
              onClick={() => downloadImage(image)}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-2"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageModal