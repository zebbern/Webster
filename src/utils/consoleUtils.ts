// Global console management for production-like experience
let isProductionMode = false

export const enableProductionMode = () => {
  if (isProductionMode) return
  isProductionMode = true

  // Store original console methods
  const originalLog = console.log
  const originalWarn = console.warn
  const originalInfo = console.info
  const originalError = console.error
  const originalDebug = console.debug

  // Define what messages to silence
  const shouldSilence = (message: any) => {
    if (typeof message !== 'string') return false
    const lowerMessage = message.toLowerCase()
    
    return (
      // Blink/Auth related
      lowerMessage.includes('initializing blink') ||
      lowerMessage.includes('auth not required') ||
      lowerMessage.includes('no tokens found') ||
      lowerMessage.includes('continuing without authentication') ||
      lowerMessage.includes('checking localstorage') ||
      lowerMessage.includes('no access token found') ||
      lowerMessage.includes('extracting tokens') ||
      lowerMessage.includes('blink auth') ||
      lowerMessage.includes('authentication') ||
      message.includes('🚀') ||
      message.includes('⚠️') ||
      
      // Development/build related
      lowerMessage.includes('vite') ||
      lowerMessage.includes('hot reload') ||
      lowerMessage.includes('hmr') ||
      lowerMessage.includes('dev server') ||
      lowerMessage.includes('[vite]') ||
      lowerMessage.includes('node_modules') ||
      
      // Network/CORS related - silence these specific cookie errors
      lowerMessage.includes('cookie') ||
      lowerMessage.includes('samesite') ||
      lowerMessage.includes('cross-site context') ||
      lowerMessage.includes('lax') ||
      lowerMessage.includes('strict') ||
      message.includes('_gh_sess') ||
      message.includes('_octo') ||
      message.includes('logged_in') ||
      lowerMessage.includes('cors') ||
      lowerMessage.includes('preflight') ||
      lowerMessage.includes('options request') ||
      
      // Generic noise
      lowerMessage.includes('connecting...') ||
      lowerMessage.includes('connected.') ||
      lowerMessage.includes('download the react devtools')
    )
  }

  // Override console methods
  console.log = (...args) => {
    if (shouldSilence(args[0])) return
    originalLog(...args)
  }

  console.warn = (...args) => {
    if (shouldSilence(args[0])) return
    originalWarn(...args)
  }

  console.info = (...args) => {
    if (shouldSilence(args[0])) return
    originalInfo(...args)
  }

  console.debug = (...args) => {
    if (shouldSilence(args[0])) return
    originalDebug(...args)
  }

  // Keep errors but filter some noise
  console.error = (...args) => {
    if (shouldSilence(args[0])) return
    originalError(...args)
  }

  // Also silence specific global error patterns and console.error calls
  const originalOnError = window.onerror
  window.onerror = (msg, url, line, col, error) => {
    if (typeof msg === 'string' && shouldSilence(msg)) {
      return true // Prevent default error handling
    }
    if (originalOnError) {
      return originalOnError(msg, url, line, col, error)
    }
    return false
  }

  // Override console.error more aggressively for CORS cookie errors
  const originalConsoleError = console.error
  console.error = (...args) => {
    const message = args.join(' ')
    if (
      message.includes('Cookie') ||
      message.includes('SameSite') ||
      message.includes('cross-site context') ||
      message.includes('_gh_sess') ||
      message.includes('_octo') ||
      message.includes('logged_in') ||
      message.includes('zebbern.png')
    ) {
      return // Completely silence these
    }
    originalConsoleError(...args)
  }
}

export const disableProductionMode = () => {
  if (!isProductionMode) return
  // This would restore original console methods if needed
  // For now, just reload the page to reset
  isProductionMode = false
}