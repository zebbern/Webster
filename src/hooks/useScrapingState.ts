import { useState, useCallback } from 'react'
import { ScrapedImage, ScrapeProgress } from '../utils/advancedImageScraper'
import { ScrapingState, SequentialPattern, ScrapingStats } from '../types/scraping'
import { TIMING } from '../constants'

export const useScrapingState = () => {
  const [images, setImages] = useState<ScrapedImage[]>([])
  const [progress, setProgress] = useState<ScrapeProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ScrapingStats>({
    total: 0,
    duplicates: 0,
    filtered: 0
  })
  const [sequentialPattern, setSequentialPattern] = useState<SequentialPattern | null>(null)
  const [isImageStateResetting, setIsImageStateResetting] = useState(false)

  const handleProgress = useCallback((newProgress: ScrapeProgress | null) => {
    setProgress(newProgress)
  }, [])

  const handleNewImage = useCallback((image: ScrapedImage) => {
    setImages(prev => {
      const exists = prev.some(existingImage => existingImage.url === image.url)
      if (exists) {
        setStats(prevStats => ({
          ...prevStats,
          duplicates: prevStats.duplicates + 1
        }))
        return prev
      }
      
      setStats(prevStats => ({
        ...prevStats,
        total: prevStats.total + 1
      }))
      
      return [...prev, image]
    })
  }, [])

  const removeImageOnError = useCallback((url: string) => {
    setImages(prev => prev.filter(img => img.url !== url))
  }, [])

  const resetState = useCallback(async () => {
    setIsImageStateResetting(true)
    
    setImages([])
    setProgress(null)
    setError(null)
    setStats({ total: 0, duplicates: 0, filtered: 0 })
    setSequentialPattern(null)
    
    await new Promise(resolve => setTimeout(resolve, TIMING.IMAGE_STATE_RESET_DELAY))
    setIsImageStateResetting(false)
  }, [])

  const state: ScrapingState = {
    images,
    progress,
    isLoading,
    error,
    stats,
    sequentialPattern,
    isImageStateResetting
  }

  const actions = {
    handleProgress,
    handleNewImage,
    removeImageOnError,
    resetState,
    setIsLoading,
    setError,
    setSequentialPattern,
    setStats
  }

  return { state, actions }
}