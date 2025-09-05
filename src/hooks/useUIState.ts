import { useState, useCallback } from 'react'
import { UIState } from '../types/scraping'

export const useUIState = () => {
  const [showConfiguration, setShowConfiguration] = useState(false)
  const [showUrlPatterns, setShowUrlPatterns] = useState(false)
  const [showImageFilters, setShowImageFilters] = useState(false)
  const [previewActive, setPreviewActive] = useState(false)
  const [tooltipStates, setTooltipStates] = useState<Record<string, boolean>>({})

  const toggleConfiguration = useCallback(() => {
    setShowConfiguration(prev => !prev)
  }, [])

  const toggleUrlPatterns = useCallback(() => {
    setShowUrlPatterns(prev => !prev)
  }, [])

  const toggleImageFilters = useCallback(() => {
    setShowImageFilters(prev => !prev)
  }, [])

  const toggleTooltip = useCallback((key: string) => {
    setTooltipStates(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }, [])

  const state: UIState = {
    showConfiguration,
    showUrlPatterns,
    showImageFilters,
    previewActive,
    tooltipStates
  }

  const actions = {
    toggleConfiguration,
    toggleUrlPatterns,
    toggleImageFilters,
    setPreviewActive,
    toggleTooltip
  }

  return { state, actions }
}