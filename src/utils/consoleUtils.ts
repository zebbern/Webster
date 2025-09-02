// Simple console utility for production mode
let isProductionMode = false

export const enableProductionMode = () => {
  if (isProductionMode) return
  isProductionMode = true

  const originalError = console.error
  
  // Only filter cookie-related noise
  console.error = (...args) => {
    const message = args.join(' ')
    if (
      message.includes('Cookie') ||
      message.includes('SameSite') ||
      message.includes('cross-site')
    ) {
      return
    }
    originalError(...args)
  }
}

export const disableProductionMode = () => {
  isProductionMode = false
}