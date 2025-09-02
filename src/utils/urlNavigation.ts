/**
 * Utility functions for URL navigation and chapter detection
 */

export interface ChapterInfo {
  hasChapter: boolean
  chapterNumber: number
  chapterSegment: string
  baseUrl: string
}

/**
 * Parse a URL to detect chapter information
 * Looks for patterns like "chapter-0", "ch-1", "episode-5", etc.
 */
export function parseChapterFromUrl(url: string): ChapterInfo {
  try {
    const urlObj = new URL(url)
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0)
    
    // Look for the last segment that contains a number
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const segment = pathSegments[i]
      
      // Match patterns like: chapter-0, ch-1, episode-5, part-10, etc.
      const chapterMatch = segment.match(/^(chapter|ch|episode|ep|part|p)[-_]?(\d+)$/i)
      if (chapterMatch) {
        const chapterNumber = parseInt(chapterMatch[2], 10)
        return {
          hasChapter: true,
          chapterNumber,
          chapterSegment: segment,
          baseUrl: url
        }
      }
      
      // Also match pure numbers at the end of segments
      const numberMatch = segment.match(/^(\d+)$/)
      if (numberMatch) {
        const chapterNumber = parseInt(numberMatch[1], 10)
        return {
          hasChapter: true,
          chapterNumber,
          chapterSegment: segment,
          baseUrl: url
        }
      }
    }
    
    return {
      hasChapter: false,
      chapterNumber: 0,
      chapterSegment: '',
      baseUrl: url
    }
  } catch (error) {
    return {
      hasChapter: false,
      chapterNumber: 0,
      chapterSegment: '',
      baseUrl: url
    }
  }
}

/**
 * Generate a new URL with the chapter number incremented or decremented
 */
export function generateChapterUrl(url: string, direction: 'prev' | 'next'): string | null {
  const chapterInfo = parseChapterFromUrl(url)
  
  if (!chapterInfo.hasChapter) {
    return null
  }
  
  const newChapterNumber = direction === 'next' 
    ? chapterInfo.chapterNumber + 1 
    : chapterInfo.chapterNumber - 1
  
  // Don't allow negative chapter numbers
  if (newChapterNumber < 0) {
    return null
  }
  
  try {
    const urlObj = new URL(url)
    const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0)
    
    // Find and replace the chapter segment
    for (let i = pathSegments.length - 1; i >= 0; i--) {
      const segment = pathSegments[i]
      
      if (segment === chapterInfo.chapterSegment) {
        // Determine the new segment format based on the original
        const chapterMatch = segment.match(/^(chapter|ch|episode|ep|part|p)[-_]?(\d+)$/i)
        if (chapterMatch) {
          const prefix = chapterMatch[1]
          const separator = segment.includes('-') ? '-' : (segment.includes('_') ? '_' : '')
          pathSegments[i] = `${prefix}${separator}${newChapterNumber}`
        } else if (segment.match(/^\d+$/)) {
          pathSegments[i] = newChapterNumber.toString()
        }
        break
      }
    }
    
    // Reconstruct the URL
    urlObj.pathname = '/' + pathSegments.join('/') + (url.endsWith('/') ? '/' : '')
    return urlObj.toString()
  } catch (error) {
    return null
  }
}

/**
 * Check if navigation arrows should be enabled
 */
export function getNavigationState(url: string): { canGoPrev: boolean; canGoNext: boolean } {
  const chapterInfo = parseChapterFromUrl(url)
  
  if (!chapterInfo.hasChapter) {
    return { canGoPrev: false, canGoNext: false }
  }
  
  return {
    canGoPrev: chapterInfo.chapterNumber > 0,
    canGoNext: true // We always allow going to next chapter
  }
}