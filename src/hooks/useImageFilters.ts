import { useState, useCallback, useEffect } from 'react'
import { FilterState } from '../types/scraping'
import { UI_CONFIG } from '../constants'

export const useImageFilters = () => {
  const [imageFilters, setImageFilters] = useState<string[]>([])
  const [newFilter, setNewFilter] = useState('')
  const [customUrlPatterns, setCustomUrlPatterns] = useState('')

  // Load filters from localStorage on mount
  useEffect(() => {
    const savedFilters = localStorage.getItem(UI_CONFIG.STORAGE_KEYS.IMAGE_FILTERS)
    if (savedFilters) {
      try {
        const parsedFilters = JSON.parse(savedFilters)
        if (Array.isArray(parsedFilters)) {
          setImageFilters(parsedFilters)
        }
      } catch (error) {
        console.warn('Failed to parse saved image filters:', error)
      }
    }
  }, [])

  // Save filters to localStorage when they change
  useEffect(() => {
    localStorage.setItem(UI_CONFIG.STORAGE_KEYS.IMAGE_FILTERS, JSON.stringify(imageFilters))
  }, [imageFilters])

  const addFilter = useCallback((filter: string) => {
    const trimmedFilter = filter.trim()
    if (trimmedFilter && !imageFilters.includes(trimmedFilter)) {
      setImageFilters(prev => [...prev, trimmedFilter])
    }
  }, [imageFilters])

  const removeFilter = useCallback((filter: string) => {
    setImageFilters(prev => prev.filter(f => f !== filter))
  }, [])

  const clearAllFilters = useCallback(() => {
    setImageFilters([])
    localStorage.removeItem(UI_CONFIG.STORAGE_KEYS.IMAGE_FILTERS)
  }, [])

  const shouldFilterImage = useCallback((url: string): boolean => {
    return imageFilters.some(filter => {
      try {
        // Check if filter is a regex pattern (contains regex special characters)
        if (filter.includes('*') || filter.includes('+') || filter.includes('?') || filter.includes('[') || filter.includes('(')) {
          // Convert simple wildcard patterns to regex
          const regexPattern = filter
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
            .replace(/\\\*/g, '.*') // Convert * to .*
            .replace(/\\\?/g, '.') // Convert ? to .
          
          const regex = new RegExp(regexPattern, 'i')
          return regex.test(url)
        } else {
          // Simple string matching (case insensitive)
          return url.toLowerCase().includes(filter.toLowerCase())
        }
      } catch (error) {
        // If regex fails, fall back to simple string matching
        return url.toLowerCase().includes(filter.toLowerCase())
      }
    })
  }, [imageFilters])

  const applyUrlPatterns = useCallback(() => {
    if (!customUrlPatterns.trim()) return
    
    const patterns = customUrlPatterns
      .split('\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
    
    patterns.forEach(pattern => addFilter(pattern))
    setCustomUrlPatterns('')
  }, [customUrlPatterns, addFilter])

  const exportUrlPatterns = useCallback(() => {
    const patternsText = imageFilters.join('\n')
    const blob = new Blob([patternsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = 'webster-image-filters.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }, [imageFilters])

  const state: FilterState = {
    imageFilters,
    newFilter,
    customUrlPatterns
  }

  const actions = {
    addFilter,
    removeFilter,
    clearAllFilters,
    shouldFilterImage,
    setNewFilter,
    setCustomUrlPatterns,
    applyUrlPatterns,
    exportUrlPatterns
  }

  return { state, actions }
}