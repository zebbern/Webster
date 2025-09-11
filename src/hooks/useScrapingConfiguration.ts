import { useState, useCallback } from 'react'
import { ScrapingConfiguration } from '../types/scraping'
import { DEFAULTS, THRESHOLDS, getFetchIntervals, getMinFetchInterval } from '../constants'

export const useScrapingConfiguration = () => {
  const [scrapingMethod, setScrapingMethod] = useState<'smart' | 'fast'>(DEFAULTS.SCRAPING_METHOD)
  const [fileTypes, setFileTypes] = useState<string[]>([...DEFAULTS.FILE_TYPES])
  const [chapterCount, setChapterCount] = useState(DEFAULTS.CHAPTER_COUNT)
  const [consecutiveMissThreshold, setConsecutiveMissThreshold] = useState(DEFAULTS.CONSECUTIVE_MISS_THRESHOLD)
  const [validateImages, setValidateImages] = useState(DEFAULTS.VALIDATE_IMAGES)
  const [fetchInterval, setFetchInterval] = useState(DEFAULTS.FETCH_INTERVAL_SECONDS)
  const [showScrollButtons, setShowScrollButtons] = useState(DEFAULTS.SHOW_SCROLL_BUTTONS)
  const [backgroundPreloading, setBackgroundPreloading] = useState(DEFAULTS.BACKGROUND_PRELOADING)
  const [autoScroll, setAutoScroll] = useState(DEFAULTS.AUTO_SCROLL)
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(DEFAULTS.AUTO_SCROLL_SPEED)

  const updateScrapingMethod = useCallback((method: 'smart' | 'fast') => {
    setScrapingMethod(method)
  }, [])

  const updateFileTypes = useCallback((types: string[]) => {
    setFileTypes(types)
  }, [])

  const updateChapterCount = useCallback((count: number) => {
    setChapterCount(count)
    
    // Auto-adjust fetch interval based on chapter count
    const minInterval = getMinFetchInterval(count)
    if (fetchInterval < minInterval) {
      setFetchInterval(minInterval)
    }
  }, [fetchInterval])

  const updateConsecutiveMissThreshold = useCallback((threshold: number) => {
    setConsecutiveMissThreshold(threshold)
  }, [])

  const updateValidateImages = useCallback((validate: boolean) => {
    setValidateImages(validate)
  }, [])

  const updateFetchInterval = useCallback((interval: number) => {
    const minInterval = getMinFetchInterval(chapterCount)
    setFetchInterval(Math.max(interval, minInterval))
  }, [chapterCount])

  const updateShowScrollButtons = useCallback((show: boolean) => {
    setShowScrollButtons(show)
  }, [])

  const updateBackgroundPreloading = useCallback((enabled: boolean) => {
    setBackgroundPreloading(enabled)
  }, [])

  const updateAutoScroll = useCallback((enabled: boolean) => {
    setAutoScroll(enabled)
  }, [])

  const updateAutoScrollSpeed = useCallback((speed: number) => {
    setAutoScrollSpeed(Math.max(0.5, Math.min(10, speed))) // Clamp between 0.5 and 10
  }, [])

  const toggleFileType = useCallback((type: string) => {
    setFileTypes(prev => {
      if (prev.includes(type)) {
        return prev.filter(t => t !== type)
      } else {
        return [...prev, type]
      }
    })
  }, [])

  const configuration: ScrapingConfiguration = {
    scrapingMethod,
    fileTypes,
    chapterCount,
    consecutiveMissThreshold,
    validateImages,
    fetchInterval,
    showScrollButtons,
    backgroundPreloading,
    autoScroll,
    autoScrollSpeed
  }

  const actions = {
    updateScrapingMethod,
    updateFileTypes,
    updateChapterCount,
    updateConsecutiveMissThreshold,
    updateValidateImages,
    updateFetchInterval,
    updateShowScrollButtons,
    updateBackgroundPreloading,
    updateAutoScroll,
    updateAutoScrollSpeed,
    toggleFileType
  }

  return { configuration, actions }
}