import { useEffect } from 'react'

/**
 * Custom hook to lock/unlock body scroll
 * Prevents background scrolling when modals or overlays are open
 * Maintains scroll position when lock is released
 */
export const useBodyScrollLock = (isLocked: boolean): void => {
  useEffect(() => {
    if (!isLocked) return

    // Store current scroll position
    const scrollY = window.scrollY
    
    // Lock body scroll
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    
    return () => {
      // Restore body scroll
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      
      // Restore scroll position
      window.scrollTo(0, scrollY)
    }
  }, [isLocked])
}