// Client-side image conversion utilities using Canvas API

export const convertWebPToPNG = async (webpBlob: Blob): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // Create an image element
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        // Create a canvas with the image dimensions
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Canvas context not available'))
          return
        }
        
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        
        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0)
        
        // Convert canvas to PNG blob
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            resolve(pngBlob)
          } else {
            reject(new Error('Failed to convert image to PNG'))
          }
        }, 'image/png', 1.0) // Maximum quality
        
        // Clean up
        URL.revokeObjectURL(img.src)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(img.src)
      reject(new Error('Failed to load WebP image for conversion'))
    }
    
    // Load the WebP blob as image
    img.src = URL.createObjectURL(webpBlob)
  })
}

export const shouldConvertToPNG = (imageType: string): boolean => {
  // Convert WebP to PNG for better compatibility
  return imageType.toLowerCase() === 'webp'
}

export const getConvertedFilename = (originalFilename: string, newExtension: string): string => {
  const parts = originalFilename.split('.')
  if (parts.length < 2) {
    return `${originalFilename}.${newExtension}`
  }
  
  parts[parts.length - 1] = newExtension
  return parts.join('.')
}