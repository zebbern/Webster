import React, { useMemo } from 'react'
import ImageGallery from './ImageGallery'
import { ScrapedImage } from '../utils/advancedImageScraper'
import { parseChapterFromUrl } from '../utils/urlNavigation'
import { TIMING } from '../constants'

interface ScrapingResultsSectionProps {
  images: ScrapedImage[]
  url: string
  filterFunction: (url: string) => boolean
  onImageError: (url: string) => void
  onPreviewChange: (active: boolean) => void
  showScrollButtons: boolean
  initialPreviewMode: boolean
  autoNextChapter: boolean
  onNextChapter: (nextUrl: string) => void
  onStartNavigation: () => void
  onPreviewEnter: () => void
  onPreviousChapter: () => void
  currentChapter: number
  isNavigating: boolean
  isLoading: boolean
  lastAutoScrollTime: number
  lastPreviewEnterTime: number
  chapterCount: number
  updateChapterUrl: (chapterNumber: number, immediate?: boolean) => string
  updateLastScrollTime: (time: number) => void
}

export const ScrapingResultsSection = React.memo(({
  images,
  url,
  filterFunction,
  onImageError,
  onPreviewChange,
  showScrollButtons,
  initialPreviewMode,
  autoNextChapter,
  onNextChapter,
  onStartNavigation,
  onPreviewEnter,
  onPreviousChapter,
  currentChapter,
  isNavigating,
  isLoading,
  lastAutoScrollTime,
  lastPreviewEnterTime,
  chapterCount,
  updateChapterUrl,
  updateLastScrollTime
}: ScrapingResultsSectionProps) => {
  // Memoize filtered images to prevent unnecessary recalculations
  const filteredImages = useMemo(() => 
    images.filter(img => !filterFunction(img.url)),
    [images, filterFunction]
  )

  // Don't render if no images
  if (images.length === 0) {
    return null
  }

  const handleAutoNextChapter = () => {
    const now = Date.now()
    
    // Check both cooldowns: 30s after last auto navigation and 25s after entering preview
    const autoScrollCooldownOK = now - lastAutoScrollTime >= TIMING.AUTO_CHAPTER_COOLDOWN
    const previewEnterCooldownOK = now - lastPreviewEnterTime >= TIMING.AUTO_CHAPTER_PREVIEW_DELAY
    
    if (autoScrollCooldownOK && previewEnterCooldownOK && !isLoading && !isNavigating) { 
      // Auto next chapter triggered - update timestamp immediately
      updateLastScrollTime(now)
      
      // Update URL to next chapter and trigger scraping with the new URL
      const chapterInfo = parseChapterFromUrl(url)
      if (chapterInfo.hasChapter) {
        const nextChapterNumber = chapterInfo.chapterNumber + chapterCount
        const nextChapterUrl = updateChapterUrl(nextChapterNumber, true)
        // Auto navigating to next chapter
        
        // Use the new URL directly
        if (nextChapterUrl && nextChapterUrl !== url) {
          onNextChapter(nextChapterUrl)
        } else {
          // Failed to generate next chapter URL, falling back
          onNextChapter(url)
        }
      }
    } else {
      const scrollCooldownRemaining = Math.max(0, TIMING.AUTO_CHAPTER_COOLDOWN - (now - lastAutoScrollTime)) / 1000
      const previewCooldownRemaining = Math.max(0, TIMING.AUTO_CHAPTER_PREVIEW_DELAY - (now - lastPreviewEnterTime)) / 1000
      const remainingTime = Math.max(scrollCooldownRemaining, previewCooldownRemaining)
      // Auto next chapter blocked by cooldown
    }
  }

  return (
    <div>
      <ImageGallery 
        images={filteredImages}
        websiteUrl={url} 
        onImageError={onImageError} 
        onPreviewChange={onPreviewChange} 
        showScrollButtons={showScrollButtons} 
        initialPreviewMode={initialPreviewMode}
        autoNextChapter={autoNextChapter}
        onNextChapter={handleAutoNextChapter}
        onStartNavigation={onStartNavigation}
        onPreviewEnter={onPreviewEnter}
        onPreviousChapter={onPreviousChapter}
        currentChapter={currentChapter}
        isNavigating={isNavigating}
      />
    </div>
  )
})

ScrapingResultsSection.displayName = 'ScrapingResultsSection'