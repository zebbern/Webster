import { ScrapedImage } from './advancedImageScraper'
import { saveAs } from 'file-saver'
import { convertWebPToPNG, shouldConvertToPNG, getConvertedFilename } from './imageConverter'
import { TIMING } from '../constants'

export const downloadImage = async (image: ScrapedImage) => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    // Use our internal API proxy to avoid CORS errors
    const proxyUrl = `/api/fetch?url=${encodeURIComponent(image.url)}`
    const proxyResponse = await fetch(proxyUrl, { signal: controller.signal })
    
    if (!proxyResponse.ok) {
      throw new Error(`Proxy failed: ${proxyResponse.status}`)
    }
    
    const proxyData = await proxyResponse.json()
    if (!proxyData.body) {
      throw new Error('No content from proxy')
    }
    
    // Handle different response formats from our API
    let blob: Blob
    if (proxyData.encoding === 'base64') {
      // Binary data returned as base64
      const binaryString = atob(proxyData.body)
      const bytes = new Uint8Array(binaryString.length)
      for (let j = 0; j < binaryString.length; j++) {
        bytes[j] = binaryString.charCodeAt(j)
      }
      // Set proper MIME type for the blob to help browsers handle it correctly
      const mimeType = getMimeType(image.type)
      blob = new Blob([bytes], { type: mimeType })
    } else {
      // Text data
      blob = new Blob([proxyData.body])
    }

    clearTimeout(timeoutId)

    if (blob.size === 0) {
      throw new Error('Received empty file')
    }

    // Convert WebP to PNG for better compatibility
    let finalBlob = blob
    let filename = getFilenameFromUrl(image.url) || `image.${image.type}`
    
    if (shouldConvertToPNG(image.type)) {
      try {
        finalBlob = await convertWebPToPNG(blob)
        filename = getConvertedFilename(filename, 'png')
      } catch (conversionError) {
        console.warn('Failed to convert WebP to PNG, downloading as WebP:', conversionError)
        // Continue with original blob if conversion fails
      }
    }

    try {
      const saved = await attemptSaveAs(finalBlob, filename)
      if (saved) return
    } catch (fsError) {
      console.warn('file-saver failed, falling back to anchor download', fsError)
    }

    // Force download using blob URL to avoid redirect
    if (typeof window !== 'undefined') {
      const objectUrl = URL.createObjectURL(finalBlob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      a.rel = 'noopener'
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
      return
    } else {
      throw new Error('Unable to download file in this environment')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorName = error instanceof Error ? error.name : 'Error'

    console.warn(`Failed to download image from ${image.url}:`, {
      name: errorName,
      message: errorMessage,
      url: image.url
    })

    // Fallback: try anchor/open fallback or copy URL to clipboard
    try {
      if (typeof window !== 'undefined') {
        const a = document.createElement('a')
        a.href = image.url
        a.target = '_blank'
        a.rel = 'noopener'
        try {
          a.download = getFilenameFromUrl(image.url) || `image.${image.type}`
        } catch (e) {
          console.debug('download attribute may be ignored for cross-origin URLs', e)
        }
        document.body.appendChild(a)
        a.click()
        a.remove()
        console.info('Attempted anchor/open fallback for image')
        return
      }
    } catch (fallbackError) {
      console.warn('Failed to open image in new tab as fallback:', fallbackError)
      // Final fallback: copy URL to clipboard
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(image.url)
          alert('Could not download image. URL copied to clipboard instead.')
        } else {
          alert(`Could not download image. Please copy this URL manually: ${image.url}`)
        }
      } catch (clipboardError) {
        console.warn('Failed to copy to clipboard:', clipboardError)
        alert(`Could not download image. Please copy this URL manually: ${image.url}`)
      }
    }
  }
}

export const downloadAllImages = async (images: ScrapedImage[]) => {
  if (images.length === 0) return

  let successCount = 0
  let failCount = 0
  const fallbackUrls: string[] = []

  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

      // Use our internal API proxy to avoid CORS errors
      const proxyUrl = `/api/fetch?url=${encodeURIComponent(image.url)}`
      const proxyResponse = await fetch(proxyUrl, { signal: controller.signal })
      
      clearTimeout(timeoutId)

      if (!proxyResponse.ok) {
        throw new Error(`Proxy failed: ${proxyResponse.status}`)
      }
      
      const proxyData = await proxyResponse.json()
      if (!proxyData.body) {
        throw new Error('No content from proxy')
      }
      
      // Handle different response formats from our API
      let blob: Blob
      if (proxyData.encoding === 'base64') {
        // Binary data returned as base64
        const binaryString = atob(proxyData.body)
        const bytes = new Uint8Array(binaryString.length)
        for (let j = 0; j < binaryString.length; j++) {
          bytes[j] = binaryString.charCodeAt(j)
        }
        // Set proper MIME type for the blob to help browsers handle it correctly
        const mimeType = getMimeType(image.type)
        blob = new Blob([bytes], { type: mimeType })
      } else {
        // Text data
        blob = new Blob([proxyData.body])
      }

      if (blob.size === 0) {
        throw new Error('Received empty file')
      }

      // Convert WebP to PNG for better compatibility
      let finalBlob = blob
      let filename = getFilenameFromUrl(image.url) || `image-${i + 1}.${image.type}`
      
      if (shouldConvertToPNG(image.type)) {
        try {
          finalBlob = await convertWebPToPNG(blob)
          filename = getConvertedFilename(filename, 'png')
        } catch (conversionError) {
          console.warn(`Failed to convert WebP to PNG for image ${i + 1}, downloading as WebP:`, conversionError)
          // Continue with original blob if conversion fails
        }
      }

      try {
        saveAs(finalBlob, filename)
        successCount++
      } catch (fsError) {
        console.warn('file-saver failed for image, falling back to anchor download', fsError)
        // Try anchor fallback
        try {
          if (typeof window !== 'undefined') {
            const objectUrl = URL.createObjectURL(finalBlob)
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = filename
            a.rel = 'noopener'
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            a.remove()
            setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
            successCount++
          }
        } catch (anchorErr) {
          console.warn('Anchor fallback failed after blob fetch:', anchorErr)
          // As last resort, append to fallbackUrls for manual handling
          fallbackUrls.push(image.url)
          failCount++
        }
      }

      // Small delay to reduce chance of blocking/popups
      await new Promise(res => setTimeout(res, TIMING.DOWNLOAD_DELAY_BETWEEN_IMAGES))
    } catch (error) {
      // Fetch or blob failed (likely CORS/network)
      console.warn(`Failed to fetch/download image ${i + 1}/${images.length} (${image.url}):`, error)
      // Attempt anchor/open fallback immediately
      const opened = tryOpenUrlFallback(image.url)
      if (opened) {
        // Consider as attempted fallback (count as success to avoid "no images" message)
        successCount++
      } else {
        fallbackUrls.push(image.url)
        failCount++
      }
      // continue
    }
  }

  // Final summary logic
  if (successCount === 0 && fallbackUrls.length > 0) {
    // Create a downloadable text file with fallback URLs to help user save them manually
    try {
      const txt = fallbackUrls.join('\n')
      const blob = new Blob([txt], { type: 'text/plain' })
      try {
        const saved = await attemptSaveAs(blob, 'image-urls.txt')
        if (!saved) throw new Error('file-saver unavailable')
      } catch (saveErr) {
        console.warn('Failed to save fallback URLs file:', saveErr)
      }

      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(txt)
        }
      } catch (clipErr) {
        console.warn('Failed to copy fallback URLs to clipboard:', clipErr)
      }

      alert(`Could not download images directly due to CORS or network restrictions. A file 'image-urls.txt' with ${fallbackUrls.length} image URLs has been downloaded and copied to your clipboard. Open them in new tabs to save manually.`)
      return
    } catch (finalErr) {
      console.warn('Error while preparing fallback URLs file:', finalErr)
      alert('No images could be downloaded directly. This may be due to CORS restrictions or network issues. The image URLs are available in the console for manual download.')
      return
    }
  }

  if (failCount > 0 || fallbackUrls.length > 0) {
    console.info(`Download complete: ${successCount} attempted/downloaded, ${failCount} failed, ${fallbackUrls.length} fallback URLs`)
    alert(`Downloaded/attempted ${successCount} images. ${failCount} failures. ${fallbackUrls.length} images require manual download due to access restrictions.`)
  } else {
    console.info(`Successfully downloaded all ${successCount} images`)
    alert(`Successfully downloaded ${successCount} images.`)
  }
}

const tryOpenUrlFallback = (url: string): boolean => {
  try {
    if (typeof window === 'undefined') return false
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener'
    try {
      a.download = getFilenameFromUrl(url) || ''
    } catch (e) {
      console.debug('download attribute may be ignored for cross-origin URLs', e)
    }
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } catch (err) {
    console.warn('Failed to open URL fallback:', err)
    return false
  }
}

const getMimeType = (extension: string): string => {
  const mimeTypes: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'ico': 'image/x-icon'
  }
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
}

const attemptSaveAs = async (blob: Blob, filename: string): Promise<boolean> => {
  try {
    saveAs(blob, filename)
    return true
  } catch (error) {
    console.warn('saveAs failed:', error)
    return false
  }
}

const getFilenameFromUrl = (url: string): string | null => {
  try {
    const pathname = new URL(url).pathname
    const filename = pathname.split('/').pop()
    return filename && filename.includes('.') ? filename : null
  } catch {
    return null
  }
}

