import { useScrapingState } from './useScrapingState'
import { useNavigationState } from './useNavigationState'
import { useScrapingConfiguration } from './useScrapingConfiguration'
import { useUIState } from './useUIState'
import { useImageFilters } from './useImageFilters'

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


  return {
    // State from individual hooks
    scraping: scraping.state,
    navigation: navigation.state,
    configuration: configuration.configuration,
    ui: ui.state,
    filters: filters.state,
    
    // Actions from individual hooks
    scrapingActions: scraping.actions,
    navigationActions: navigation.actions,
    configurationActions: configuration.actions,
    uiActions: ui.actions,
    filterActions: filters.actions
  }
}