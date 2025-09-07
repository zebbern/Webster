import { useState, useCallback } from 'react'
import { NavigationState } from '../types/scraping'
import { ChapterInfo } from '../utils/urlNavigation'
import { TIMING } from '../constants'

export const useNavigationState = () => {
  const [isNavigating, setIsNavigating] = useState(false)
  const [lastPageUrl, setLastPageUrl] = useState<string | null>(null)
  const [lastAutoScrollTime, setLastAutoScrollTime] = useState(0) // Initialize to 0 to allow first auto navigation

  const setNavigating = useCallback((navigating: boolean) => {
    setIsNavigating(navigating)
  }, [])

  const updateChapterUrl = useCallback((chapterNumber: number, immediate = false): string => {
    if (!lastPageUrl) return ''
    
    try {
      const url = new URL(lastPageUrl)
      const pathParts = url.pathname.split('/')
      
      // Find chapter part and update it
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i]
        const match = part.match(/(\d+)/)
        if (match) {
          pathParts[i] = part.replace(match[1], chapterNumber.toString())
          break
        }
      }
      
      const newUrl = url.origin + pathParts.join('/')
      if (!immediate) {
        setTimeout(() => setLastPageUrl(newUrl), TIMING.AUTO_NAVIGATION_DELAY)
      } else {
        setLastPageUrl(newUrl)
      }
      
      return newUrl
    } catch {
      return lastPageUrl
    }
  }, [lastPageUrl])

  const startNavigation = useCallback(() => {
    setIsNavigating(true)
    setTimeout(() => {
      setIsNavigating(false)
    }, TIMING.NAVIGATION_LOCK_TIMEOUT)
  }, [])

  const updateLastScrollTime = useCallback((time: number) => {
    setLastAutoScrollTime(time)
  }, [])


  const state: NavigationState = {
    isNavigating,
    lastPageUrl,
    lastAutoScrollTime
  }

  const actions = {
    setNavigating,
    updateChapterUrl,
    startNavigation,
    updateLastScrollTime,
    setLastPageUrl
  }

  return { state, actions }
}