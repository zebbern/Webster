// Utility for creating CORS-proxied image URLs
export const getProxiedImageUrl = (imageUrl: string): string => {
  // Only proxy external URLs, not local assets
  if (imageUrl.startsWith('/') || imageUrl.startsWith('data:')) {
    return imageUrl
  }
  
  // Proxy external images through our API to avoid CORS issues
  return `/api/fetch?url=${encodeURIComponent(imageUrl)}`
}

// Helper to check if an image needs proxying
export const needsProxying = (imageUrl: string): boolean => {
  return !imageUrl.startsWith('/') && !imageUrl.startsWith('data:')
}