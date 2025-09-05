import { useCallback } from 'react'
import { useScrapingState } from './useScrapingState'
import { useNavigationState } from './useNavigationState'
import { useScrapingConfiguration } from './useScrapingConfiguration'
import { useUIState } from './useUIState'
import { useImageFilters } from './useImageFilters'
import { scrapeImages, clearRequestCache } from '../utils/advancedImageScraper'

/**
 * Master hook that combines all image scraping related state management
 * This provides a single interface for the ImageScraper component
 */
export const useImageScrapingState = () => {
  const scraping = useScrapingState()
  const navigation = useNavigationState()
  const configuration = useScrapingConfiguration()
  const ui = useUIState()
  const filters = useImageFilters()

  // Main scraping action that combines multiple hooks
  const startScraping = useCallback(async (url?: string) => {
    if (scraping.state.isLoading || scraping.state.isImageStateResetting) return

    try {
      scraping.actions.setIsLoading(true)
      scraping.actions.setError(null)

      // Clear request cache for fresh start
      clearRequestCache()

      const targetUrl = url || navigation.state.lastPageUrl
      if (!targetUrl) {
        throw new Error('No URL provided for scraping')
      }

      // Update navigation state
      navigation.actions.setLastPageUrl(targetUrl)
      
      await scrapeImages(
        targetUrl,
        configuration.configuration,
        scraping.actions.handleProgress,
        scraping.actions.handleNewImage,
        scraping.actions.removeImageOnError,
        filters.actions.shouldFilterImage
      )

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      scraping.actions.setError(errorMessage)
      console.error('Scraping failed:', error)
    } finally {
      scraping.actions.setIsLoading(false)
    }
  }, [
    scraping.state.isLoading,
    scraping.state.isImageStateResetting,
    scraping.actions,
    navigation.state.lastPageUrl,
    navigation.actions,
    configuration.configuration,
    filters.actions
  ])

  const stopScraping = useCallback(() => {
    scraping.actions.setIsLoading(false)
    scraping.actions.setError(null)
  }, [scraping.actions])

  return {
    // State from individual hooks
    scraping: scraping.state,
    navigation: navigation.state,
    configuration: configuration.configuration,
    ui: ui.state,
    filters: filters.state,
    
    // Actions from individual hooks
    scrapingActions: {
      ...scraping.actions,
      startScraping,
      stopScraping
    },
    navigationActions: navigation.actions,
    configurationActions: configuration.actions,
    uiActions: ui.actions,
    filterActions: filters.actions
  }
}