import corsClient from '../cors/client'
import { urlPatternManager, extractChapterNumber } from './urlPatterns'
import {
  TIMING,
  DEFAULTS,
  THRESHOLDS,
  REGEX_PATTERNS,
  ERROR_MESSAGES,
  shouldRetryHttpStatus
} from '../constants'

// Request deduplication cache to prevent conflicting simultaneous requests
const requestCache = new Map<string, Promise<{ body: string; status: number; headers: Headers }>>()

// Function to clear the request cache (useful between chapter navigations)
export const clearRequestCache = () => {
  requestCache.clear()
}

// Simple fetch wrapper using CORS client API with rate limiting and deduplication
const fetchData = async (url: string, method: 'GET' | 'HEAD' = 'GET', signal?: AbortSignal, retries = DEFAULTS.RETRY_COUNT) => {
  // Create cache key based on URL and method
  const cacheKey = `${method}:${url}`
  
  // Check if there's already a pending request for this URL+method
  if (requestCache.has(cacheKey)) {
    try {
      return await requestCache.get(cacheKey)!
    } catch (error) {
      // If cached request failed, remove it from cache and continue with new request
      requestCache.delete(cacheKey)
    }
  }
  
  // Temporarily silence console during fetch to reduce noise
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  
  // Create the request promise and cache it
  const requestPromise = (async () => {
    try {
      const fetched = await corsClient.data.fetch({ url, method, signal })
      if (signal?.aborted) throw new Error('Aborted')
      
      // Handle rate limiting, SSL handshake failures, and timeouts with exponential backoff
      if (shouldRetryHttpStatus(fetched.status) && retries > 0) {
        // Longer delays for SSL issues and timeouts, shorter for rate limiting
        let baseDelay: number
        let errorType: string
        
        if (fetched.status === 525) {
          baseDelay = TIMING.RETRY_DELAY.SSL
          errorType = 'SSL Handshake Failed'
        } else if (fetched.status === 408) {
          baseDelay = TIMING.RETRY_DELAY.TIMEOUT
          errorType = 'Request Timeout'
        } else {
          baseDelay = TIMING.RETRY_DELAY.RATE_LIMIT
          errorType = 'Rate Limited'
        }
        
        const delay = baseDelay * Math.pow(2, DEFAULTS.RETRY_COUNT - retries) // Exponential backoff
        
        console.log = originalLog // Temporarily restore for this message
        console.warn(`${errorType} (${fetched.status}) for ${url}, retrying in ${delay}ms... (${retries} retries left)`)
        console.log = () => {}
        
        // Remove from cache before retry to prevent caching failed attempts
        requestCache.delete(cacheKey)
        await new Promise(resolve => setTimeout(resolve, delay))
        return fetchData(url, method, signal, retries - 1)
      }
      
      // Log 525 errors that exceed retry limit
      if (fetched.status === 525) {
        console.log = originalLog
        console.error(`SSL handshake failed permanently for ${url} after all retries`)
        console.log = () => {}
      }
      
      const body = typeof fetched.body === 'string' ? fetched.body : JSON.stringify(fetched.body)
      return { body, status: fetched.status || 200, headers: new Headers() }
    } catch (error: any) {
      // Handle fetch errors (including NS_BINDING_ABORTED)
      console.log = originalLog
      console.warn = originalWarn
      
      // Log the actual error for debugging
      if (!error.message?.includes('Aborted')) {
        console.error(`Fetch error for ${url}:`, error.message)
      }
      
      // Return a failed status for any fetch error
      return { body: '', status: 500, headers: new Headers() }
    } finally {
      // Restore console
      console.log = originalLog
      console.warn = originalWarn
      // Always remove from cache when request completes (success or failure)
      requestCache.delete(cacheKey)
    }
  })()
  
  // Cache the promise
  requestCache.set(cacheKey, requestPromise)
  
  // Return the promise result
  return await requestPromise
}

export interface ScrapedImage {
  url: string
  type: string
  alt?: string
  size?: number
  dimensions?: {
    width: number
    height: number
  }
  source: 'static' | 'dynamic'
  // optional helper flag
  isDuplicate?: boolean
}

export interface ChapterResult {
  chapterNumber: number
  url: string
  success: boolean
  imageCount: number
  error?: string
}

export interface ScrapeProgress {
  stage: 'loading' | 'scanning' | 'analyzing' | 'processing'
  processed: number
  total: number
  found: number
  currentUrl?: string
  // When present, the scraper is reporting a single newly-validated image (live insertion)
  image?: ScrapedImage
  // Multi-chapter results tracking
  chapterResults?: ChapterResult[]
  failedChapters?: number[]
  successfulChapters?: number[]
}

export interface ScrapeOptions {
  onProgress?: (progress: ScrapeProgress) => void
  signal?: AbortSignal
  // How many consecutive misses to tolerate when generating sequences (default 3)
  consecutiveMissThreshold?: number
  // How many chapters to fetch (default 1)
  chapterCount?: number
  // Callback for live image insertion
  onNewImage?: (image: ScrapedImage) => void
  // Whether to validate images with HEAD requests (default false)
  validateImages?: boolean
  // Custom fetch interval in milliseconds (overrides default timing)
  fetchInterval?: number
  // Function to filter out unwanted images by URL
  imageFilter?: (url: string) => boolean
}


// Real web scraping using only direct HTML fetch
export const scrapeImages = async (
  url: string,
  fileTypes: string[],
  options: ScrapeOptions = {}
): Promise<ScrapedImage[]> => {
  const { onProgress, signal, onNewImage } = options
  const consecutiveMissThreshold = options.consecutiveMissThreshold ?? DEFAULTS.CONSECUTIVE_MISS_THRESHOLD
  const chapterCount = options.chapterCount ?? DEFAULTS.CHAPTER_COUNT
  const validateImages = options.validateImages ?? DEFAULTS.VALIDATE_IMAGES
  const fetchInterval = options.fetchInterval ?? DEFAULTS.FETCH_INTERVAL_MS
  const imageFilter = options.imageFilter // Optional image filtering function

  // Validate URL
  try {
    new URL(url)
  } catch {
    throw new Error(ERROR_MESSAGES.INVALID_URL)
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://')
  }

  const images: ScrapedImage[] = []
  const seenUrls = new Set<string>()
  
  // Chapter tracking for multi-chapter scraping
  const chapterResults: ChapterResult[] = []
  const failedChapters: number[] = []
  const successfulChapters: number[] = []

  onProgress?.({ stage: 'loading', processed: 0, total: 1, found: 0, currentUrl: url })

  try {
    // Multi-chapter support: process each chapter separately with delays
    for (let currentChapter = 1; currentChapter <= chapterCount; currentChapter++) {
      if (signal?.aborted) throw new Error('Aborted')
      
      // Add delay between chapters (except for the first one)
      if (currentChapter > 1) {
        onProgress?.({ 
          stage: 'loading', 
          processed: images.length, 
          total: DEFAULTS.SEQUENTIAL_MAX_IMAGES * chapterCount, 
          found: images.length, 
          currentUrl: `Waiting ${fetchInterval/1000} seconds before chapter ${currentChapter}...` 
        })
        
        // Configurable delay between chapters
        await new Promise(resolve => setTimeout(resolve, fetchInterval))
        if (signal?.aborted) throw new Error('Aborted')
      }
      
      // Determine the URL for this chapter
      let chapterUrl = url
      if (currentChapter > 1) {
        // Try to use URL pattern manager first
        const targetChapterNumber = extractChapterNumber(url)
        if (targetChapterNumber !== null) {
          const generatedUrl = urlPatternManager.generateChapterUrl(url, targetChapterNumber + (currentChapter - 1))
          if (generatedUrl) {
            chapterUrl = generatedUrl
          }
        }
        
        // Fallback: try to modify URL manually
        if (chapterUrl === url) {
          try {
            const urlObj = new URL(url)
            const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0)
            
            for (let i = pathSegments.length - 1; i >= 0; i--) {
              const segment = pathSegments[i]
              const chapterMatch = segment.match(REGEX_PATTERNS.NUMBER_EXTRACTION)
              if (chapterMatch) {
                const [, prefix, numberStr, suffix] = chapterMatch
                const currentNum = parseInt(numberStr, 10)
                const newNum = currentNum + (currentChapter - 1)
                const paddedNum = numberStr.startsWith('0') ? newNum.toString().padStart(numberStr.length, '0') : newNum.toString()
                pathSegments[i] = `${prefix}${paddedNum}${suffix}`
                break
              }
            }
            
            urlObj.pathname = '/' + pathSegments.join('/') + (url.endsWith('/') ? '/' : '')
            chapterUrl = urlObj.toString()
          } catch (error) {
            // Failed to generate URL for next chapter
          }
        }
      }

      onProgress?.({ 
        stage: 'loading', 
        processed: images.length, 
        total: DEFAULTS.SEQUENTIAL_MAX_IMAGES * chapterCount, 
        found: images.length, 
        currentUrl: `Fetching chapter ${currentChapter}: ${chapterUrl}` 
      })

      // Fetch the chapter with error tracking
      let chapterSuccess = false
      let chapterError: string | undefined
      let chapterImageCountStart = images.length
      
      try {
        const fetched = await fetchData(chapterUrl, 'GET', signal)
        if (signal?.aborted) throw new Error('Aborted')
        
        // Check for failed fetch (timeout, network error, etc.)
        if (fetched.status >= THRESHOLDS.HTTP_SUCCESS_THRESHOLD) {
          const errorMsg = fetched.status === 408 ? 'Request timeout (5 seconds)' : 
                          fetched.status === 404 ? ERROR_MESSAGES.CHAPTER_NOT_FOUND :
                          fetched.status === 403 ? ERROR_MESSAGES.ACCESS_FORBIDDEN :
                          `HTTP ${fetched.status}`
          throw new Error(errorMsg)
        }
        
        const body = typeof fetched.body === 'string' ? fetched.body : JSON.stringify(fetched.body)
        
        // Check for empty responses
        if (!body || body.trim().length === 0) {
          throw new Error('Empty response from server')
        }

        onProgress?.({ stage: 'scanning', processed: images.length, total: DEFAULTS.SEQUENTIAL_MAX_IMAGES * chapterCount, found: images.length, currentUrl: chapterUrl })

        // Extract initial candidates for this chapter (with generation for sequential processing)
        let imageUrls = extractImageUrls(body, [], chapterUrl, body, true)
        imageUrls = Array.from(new Set(imageUrls))

        // Check for strong sequential patterns 
        let seqInfo = detectStrongSequentialPattern(imageUrls)
        
        // Special handling: Force discovery mode for newer manhuaus.com hash-based URLs
        try {
          const chapterUrlObj = new URL(chapterUrl)
          if (chapterUrlObj.hostname.includes('manhuaus.com')) {
            // Check if any discovered URLs use the hash-based pattern
            const hasHashPattern = imageUrls.some(url => 
              /img\.manhuaus\.com\/image[^\/]*\/[^\/]+\/[^\/]+\//.test(url)
            )
            if (hasHashPattern) {
              // Force discovery mode by nullifying sequential pattern
              seqInfo = null
            }
          }
        } catch (error) {
          // Ignore URL parsing errors
        }
        
        if (seqInfo && fileTypes.includes(seqInfo.extension)) {
          // Sequential pattern detected and file type matches - do batch processing
          const { basePath, extension, pad } = seqInfo
          
          // Process images in smaller batches for server-friendly validation
          const BATCH_SIZE = DEFAULTS.BATCH_SIZE
          let consecutiveMisses = 0
          let chapterImageCount = 0
          let currentIndex = 1

          while (currentIndex <= DEFAULTS.SEQUENTIAL_MAX_IMAGES && consecutiveMisses < consecutiveMissThreshold) {
            if (signal?.aborted) throw new Error('Aborted')
            
            
            // Create batch of candidates
            const batch: string[] = []
            for (let j = 0; j < BATCH_SIZE && (currentIndex + j) <= DEFAULTS.SEQUENTIAL_MAX_IMAGES; j++) {
              const padded = (currentIndex + j).toString().padStart(pad, '0')
              const candidate = `${basePath}${padded}.${extension}`
              if (!seenUrls.has(candidate)) {
                batch.push(candidate)
              } else {
              }
            }

            // Check all images in batch, include successful ones before first failure
            let batchResults: { url: string; valid: boolean; filtered?: boolean }[] = []
            let firstFailureIndex = -1
            
            // First pass: validate all images in batch
            for (let i = 0; i < batch.length; i++) {
              const candidate = batch[i]
              let imageExists = false
            
              if (validateImages) {
                // Use HEAD request for validation
                try {
                  const res = await fetchData(candidate, 'HEAD', signal)
                  const status = res?.status ?? 200
                  imageExists = status < THRESHOLDS.HTTP_SUCCESS_THRESHOLD
                } catch (err) {
                  imageExists = false
                }
              } else {
                // Use Image element testing for no-validation mode with proper cleanup
                imageExists = await new Promise<boolean>((resolve) => {
                  const img = new Image()
                  let resolved = false
                  
                  const cleanup = () => {
                    if (resolved) return
                    resolved = true
                    img.onload = null
                    img.onerror = null
                    img.onabort = null
                    img.src = ''
                  }
                  
                  const timeout = setTimeout(() => {
                    cleanup()
                    resolve(false) // Timeout = failure
                  }, TIMING.IMAGE_VALIDATION_TIMEOUT) // 5 second timeout
                  
                  img.onload = () => {
                    clearTimeout(timeout)
                    cleanup()
                    resolve(true) // Successfully loaded
                  }
                  
                  img.onerror = () => {
                    clearTimeout(timeout)
                    cleanup()
                    resolve(false) // Failed to load
                  }
                  
                  img.onabort = () => {
                    clearTimeout(timeout)
                    cleanup()
                    resolve(false) // Request was aborted
                  }
                  
                  img.src = candidate
                })
              }

              const isFiltered = imageFilter && imageFilter(candidate)
              batchResults.push({ url: candidate, valid: imageExists, filtered: isFiltered })
              
              // Track first failure for partial inclusion logic
              if (!imageExists && firstFailureIndex === -1) {
                firstFailureIndex = i
                break // Stop checking after first failure
              }
            }

            // Second pass: include all valid images up to (but not including) first failure
            const includeUpTo = firstFailureIndex === -1 ? batchResults.length : firstFailureIndex
            let validImagesInBatch = 0
            
            for (let i = 0; i < includeUpTo; i++) {
              const result = batchResults[i]
              if (result.valid) {
                validImagesInBatch++
                chapterImageCount++
                seenUrls.add(result.url)
                
                if (!result.filtered) {
                  const newImage: ScrapedImage = { 
                    url: result.url, 
                    type: extension, 
                    source: 'static', 
                    alt: `Image from ${new URL(chapterUrl).hostname} - Chapter ${currentChapter}` 
                  }
                  images.push(newImage)
                  onNewImage?.(newImage)
                  onProgress?.({ 
                    stage: 'scanning', 
                    processed: images.length, 
                    total: DEFAULTS.SEQUENTIAL_MAX_IMAGES * chapterCount, 
                    found: images.length, 
                    currentUrl: result.url, 
                    image: newImage 
                  })
                }
              }
            }

            // Update consecutive misses based on batch result
            if (firstFailureIndex !== -1 || batch.length === 0) {
              consecutiveMisses += 1 // Increment when we hit a failure
            } else if (validImagesInBatch > 0) {
              consecutiveMisses = 0 // Reset if we found valid images
            }

            currentIndex += BATCH_SIZE
          }


        } else {
          // No sequential pattern found OR pattern extension doesn't match selected file types
          // Extract ONLY discovered URLs without generation
          const discoveredOnlyUrls = extractImageUrls(body, [], chapterUrl, body, false) // NO generation
          
          let processedCount = 0
          let consecutiveMisses = 0
          
          // Process discovered URLs one by one with immediate validation (like main method)
          for (const imageUrl of discoveredOnlyUrls) {
            if (signal?.aborted) throw new Error('Aborted')
            if (!imageUrl) continue
            if (seenUrls.has(imageUrl)) continue
            
            // Check consecutive miss threshold before processing each URL
            if (consecutiveMisses >= consecutiveMissThreshold) {
              break
            }
            
            const type = getFileTypeFromUrl(imageUrl)
            processedCount++
            
            // Skip if wrong file type
            if (!type || !fileTypes.includes(type)) {
              onProgress?.({ stage: 'scanning', processed: processedCount, total: discoveredOnlyUrls.length, found: images.length, currentUrl: imageUrl })
              continue
            }
            
            // Skip if filtered
            const isFiltered = imageFilter && imageFilter(imageUrl)
            if (isFiltered) {
              onProgress?.({ stage: 'scanning', processed: processedCount, total: discoveredOnlyUrls.length, found: images.length, currentUrl: imageUrl })
              continue
            }
            
            let imageExists = false
            
            if (validateImages) {
              // Use HEAD request for validation (same as sequential)
              try {
                const res = await fetchData(imageUrl, 'HEAD', signal)
                const status = res?.status ?? 200
                imageExists = status < THRESHOLDS.HTTP_SUCCESS_THRESHOLD
              } catch (err) {
                imageExists = false
              }
            } else {
              // Use Image element testing for no-validation mode (same as sequential)
              imageExists = await new Promise<boolean>((resolve) => {
                const img = new Image()
                let resolved = false
                
                const cleanup = () => {
                  if (resolved) return
                  resolved = true
                  img.onload = null
                  img.onerror = null
                  img.onabort = null
                  img.src = ''
                }
                
                const timeout = setTimeout(() => {
                  cleanup()
                  resolve(false) // Timeout = failure
                }, TIMING.IMAGE_VALIDATION_TIMEOUT)
                
                img.onload = () => {
                  clearTimeout(timeout)
                  cleanup()
                  resolve(true) // Successfully loaded
                }
                
                img.onerror = () => {
                  clearTimeout(timeout)
                  cleanup()
                  resolve(false) // Failed to load
                }
                
                img.onabort = () => {
                  clearTimeout(timeout)
                  cleanup()
                  resolve(false) // Request was aborted
                }
                
                img.src = imageUrl
              })
            }
            
            seenUrls.add(imageUrl)
            
            // Update consecutive misses immediately (same logic as sequential)
            if (!imageExists) {
              consecutiveMisses += 1
            } else {
              consecutiveMisses = 0 // Reset on success
              
              const newImage: ScrapedImage = { 
                url: imageUrl, 
                type: type!, 
                source: 'dynamic', 
                alt: `Image from ${new URL(chapterUrl).hostname} - Chapter ${currentChapter}` 
              }
              images.push(newImage)

              // Live insertion
              onNewImage?.(newImage)
              onProgress?.({ 
                stage: 'scanning', 
                processed: processedCount, 
                total: discoveredOnlyUrls.length, 
                found: images.length, 
                currentUrl: imageUrl, 
                image: newImage 
              })

              await new Promise(res => setTimeout(res, TIMING.PROCESSING_DELAY))
            }
          }
        }
        
        // Calculate chapter success
        const chapterImageCount = images.length - chapterImageCountStart
        chapterSuccess = chapterImageCount > 0
        
        if (!chapterSuccess) {
          chapterError = `No images found in chapter ${currentChapter}`
        }
        
      } catch (error: any) {
        chapterSuccess = false
        chapterError = error.message || 'Unknown error occurred'
        console.error(`Chapter ${currentChapter} failed:`, error)
      }
      
      // Record chapter result
      const chapterResult: ChapterResult = {
        chapterNumber: currentChapter,
        url: chapterUrl,
        success: chapterSuccess,
        imageCount: images.length - chapterImageCountStart,
        error: chapterError
      }
      
      chapterResults.push(chapterResult)
      
      if (chapterSuccess) {
        successfulChapters.push(currentChapter)
      } else {
        failedChapters.push(currentChapter)
        
        // For multi-chapter scraping, stop if a chapter fails to prevent skipping
        if (chapterCount > 1) {
          console.warn(`Chapter ${currentChapter} failed, stopping to prevent chapter skipping`)
          onProgress?.({ 
            stage: 'analyzing', 
            processed: images.length, 
            total: DEFAULTS.SEQUENTIAL_MAX_IMAGES * chapterCount, 
            found: images.length, 
            currentUrl: `Stopped at failed chapter ${currentChapter}`,
            chapterResults: [...chapterResults],
            failedChapters: [...failedChapters],
            successfulChapters: [...successfulChapters]
          })
          break // Stop processing further chapters
        }
      }
    }

    // Final progress report with chapter results
    onProgress?.({ 
      stage: 'processing', 
      processed: images.length, 
      total: images.length, 
      found: images.length,
      chapterResults: [...chapterResults],
      failedChapters: [...failedChapters],
      successfulChapters: [...successfulChapters]
    })
    
    // If we have failed chapters in multi-chapter mode, include warning in final progress
    if (chapterCount > 1 && failedChapters.length > 0) {
      const errorMessage = `Stopped at failed chapter ${failedChapters[0]} to prevent skipping chapters`
      onProgress?.({ 
        stage: 'processing', 
        processed: images.length, 
        total: images.length, 
        found: images.length,
        currentUrl: errorMessage,
        chapterResults: [...chapterResults],
        failedChapters: [...failedChapters],
        successfulChapters: [...successfulChapters]
      })
    }
    
    return images
  } catch (error: any) {
    if (error.message === 'Aborted' || options.signal?.aborted) throw new Error('Aborted')
    
    // Handle specific error types with better messages
    if (error.message?.includes('Request timeout')) {
      throw new Error(ERROR_MESSAGES.TIMEOUT_ERROR)
    }
    
    if (error.message?.includes('Empty response')) {
      throw new Error('Server returned empty response. Chapter may not exist or be accessible.')
    }
    
    throw new Error(error.message || ERROR_MESSAGES.SCRAPING_FAILED)
  }
}

// Extract image URLs from scraped content (robust checks)
function extractImageUrls(markdown: string, links: any[], baseUrl: string, extract: any = null, generateSequential: boolean = true): string[] {
  const imageUrls = new Set<string>()
  const sequentialPatterns = new Set<string>()

  const tryAdd = (rawUrl: string | null | undefined) => {
    if (!rawUrl) return
    const trimmed = rawUrl.trim()
    const resolved = resolveUrl(trimmed, baseUrl)
    if (resolved && isImageUrl(resolved)) {
      imageUrls.add(resolved)
      // Check for sequential patterns (manga sites)
      detectSequentialPattern(resolved, sequentialPatterns)
    }
  }

  // 1) Markdown image syntax
  if (typeof markdown === 'string' && markdown.length) {
    const markdownImageRegex = REGEX_PATTERNS.MARKDOWN_IMAGE
    let m
    while ((m = markdownImageRegex.exec(markdown)) !== null) {
      tryAdd(m[1])
    }
  }

  // 2) Links array from scraper
  if (Array.isArray(links)) {
    links.forEach(l => {
      if (!l) return
      if (typeof l === 'string') tryAdd(l)
      else if (typeof l === 'object') {
        if (l.href) tryAdd(l.href)
        if (l.url) tryAdd(l.url)
        if (l.image) tryAdd(l.image)
      }
    })
  }

  // 3) If extract or markdown contains raw HTML, scan it
  let htmlString = ''
  try {
    if (extract) {
      if (typeof extract === 'string') htmlString = extract
      else if (typeof extract.html === 'string') htmlString = extract.html
      else if (typeof extract.rawHtml === 'string') htmlString = extract.rawHtml
      else htmlString = JSON.stringify(extract)
    } else if (typeof markdown === 'string') {
      htmlString = markdown
    }
  } catch (err) {
    htmlString = ''
  }

  if (htmlString) {
    const imgTagRegex = REGEX_PATTERNS.IMG_TAG
    let tagMatch
    while ((tagMatch = imgTagRegex.exec(htmlString)) !== null) {
      const tag = tagMatch[0]
      const attrs = ['data-src', 'data-original', 'data-lazy-src', 'src', 'data-srcset', 'srcset', 'data-pages', 'data-images']
      attrs.forEach(attr => {
        const attrRegex = new RegExp(`${attr}\\s*=\\s*['"]([^'"]*?)\\s*['"]`, 'is')
        const m = tag.match(attrRegex)
        if (m && m[1]) {
          const value = m[1].trim().replace(/\s+/g, '')
          if (attr.includes('srcset') || attr === 'data-srcset') {
            value.split(',').forEach(part => {
              const urlPart = part.trim().split(' ')[0]
              tryAdd(urlPart)
            })
          } else {
            tryAdd(value)
          }
        }
      })
    }

    // noscript
    const noscriptRegex = /<noscript[^>]*>([\s\S]*?)<\/noscript>/gi
    let ns
    while ((ns = noscriptRegex.exec(htmlString)) !== null) {
      const inner = ns[1]
      const innerImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i
      const innerMatch = inner.match(innerImgRegex)
      if (innerMatch && innerMatch[1]) tryAdd(innerMatch[1])
    }

    // background-image inline styles
    const bgRegex = /background(?:-image)?:\s*url\(['"]?(.*?)['"]?\)/gi
    let bg
    while ((bg = bgRegex.exec(htmlString)) !== null) {
      tryAdd(bg[1])
    }

    // generic image urls in scripts / JSON
    const urlRegex = /https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^\s"'<>]*)?/gi
    let u
    while ((u = urlRegex.exec(htmlString)) !== null) {
      tryAdd(u[0])
    }

    // Enhanced: Look for URLs ending with image extensions even without protocols
    const relativeImageRegex = /(?:^|[^\w])([^\s"'<>]*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^\s"'<>]*)?)/gi
    let rel
    while ((rel = relativeImageRegex.exec(htmlString)) !== null) {
      tryAdd(rel[1])
    }

    // Enhanced: Look for image URLs in JSON objects and arrays
    const jsonImageRegex = /["']([^"']*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^"']*)?)/gi
    let json
    while ((json = jsonImageRegex.exec(htmlString)) !== null) {
      tryAdd(json[1])
    }

    // Enhanced: Look for image URLs in data attributes
    const dataAttrRegex = /data-[^=]*=["']([^"']*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^"']*)?)/gi
    let dataAttr
    while ((dataAttr = dataAttrRegex.exec(htmlString)) !== null) {
      tryAdd(dataAttr[1])
    }

    // Enhanced: Look for image URLs in CSS content property
    const cssContentRegex = /content:\s*["']([^"']*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^"']*)?)/gi
    let cssContent
    while ((cssContent = cssContentRegex.exec(htmlString)) !== null) {
      tryAdd(cssContent[1])
    }

    // Enhanced: Look for base64 encoded images (for fallback discovery)
    const base64ImageRegex = /data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/gi
    let base64
    while ((base64 = base64ImageRegex.exec(htmlString)) !== null) {
      // Skip base64 images as they're not scrapable URLs, but log for debugging
    }

    // Specific pattern: arrays in JS like ["...jpg","...jpg"]
    const arrayRegex = /\[([^\]]*?\.(?:jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)[^\]]*?)\]/gi
    let a
    while ((a = arrayRegex.exec(htmlString)) !== null) {
      const inner = a[1]
      const itemRegex = /https?:[^\s,'"\]]+/gi
      let it
      while ((it = itemRegex.exec(inner)) !== null) {
        tryAdd(it[0])
      }
      // Enhanced: Also look for relative URLs in arrays
      const relativeItemRegex = /[^https?:][^\s,'"\]]*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)/gi
      let relItem
      while ((relItem = relativeItemRegex.exec(inner)) !== null) {
        tryAdd(relItem[0])
      }
    }

    // Enhanced: Look for JavaScript variables containing image URLs
    const jsVarRegex = /(?:var|let|const)\s+[^=]*=\s*["']([^"']*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^"']*)?)/gi
    let jsVar
    while ((jsVar = jsVarRegex.exec(htmlString)) !== null) {
      tryAdd(jsVar[1])
    }

    // Enhanced: Look for image URLs in href attributes (for download links)
    const hrefImageRegex = /href=["']([^"']*\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#][^"']*)?)/gi
    let hrefImg
    while ((hrefImg = hrefImageRegex.exec(htmlString)) !== null) {
      tryAdd(hrefImg[1])
    }

    // Site-specific handling for manhuaus.com image patterns
    try {
      const baseUrlObj = new URL(baseUrl)
      if (baseUrlObj.hostname.includes('manhuaus.com')) {
        // Pattern for newer chapters: https://img.manhuaus.com/image*/manga_HASH/HASH2/NN.webp (2-3 digits for flexibility)
        const manhuausNewRegex = /https?:\/\/img\.manhuaus\.com\/image[^\/]*\/[^\/]+\/[^\/]+\/\d{2,3}\.(jpg|jpeg|png|gif|webp)/gi
        let manhuausNew
        while ((manhuausNew = manhuausNewRegex.exec(htmlString)) !== null) {
          tryAdd(manhuausNew[0])
        }
        
        // Pattern for older chapters: https://img.manhuaus.com/TITLE/chapter-N/NNN.webp
        const manhuausOldRegex = /https?:\/\/img\.manhuaus\.com\/[^\/]+\/chapter-\d+\/\d{3}\.(jpg|jpeg|png|gif|webp)/gi
        let manhuausOld
        while ((manhuausOld = manhuausOldRegex.exec(htmlString)) !== null) {
          tryAdd(manhuausOld[0])
        }
        
        // Also look for these patterns without protocol
        const relativeManhuausNewRegex = /img\.manhuaus\.com\/image[^\/]*\/[^\/\s"']+\/[^\/\s"']+\/\d{2,3}\.(jpg|jpeg|png|gif|webp)/gi
        let relManhuausNew
        while ((relManhuausNew = relativeManhuausNewRegex.exec(htmlString)) !== null) {
          tryAdd('https://' + relManhuausNew[0])
        }
        
        const relativeManhuausOldRegex = /img\.manhuaus\.com\/[^\/\s"']+\/chapter-\d+\/\d{3}\.(jpg|jpeg|png|gif|webp)/gi
        let relManhuausOld
        while ((relManhuausOld = relativeManhuausOldRegex.exec(htmlString)) !== null) {
          tryAdd('https://' + relManhuausOld[0])
        }
      }
    } catch (error) {
      // Ignore URL parsing errors for site-specific handling
    }
  }

  // 4) Plain text URLs in markdown
  if (typeof markdown === 'string') {
    const plainUrlRegex = REGEX_PATTERNS.IMAGE_URL
    let pu
    while ((pu = plainUrlRegex.exec(markdown)) !== null) tryAdd(pu[0])
  }

  // 5) Generate additional sequential images based on detected patterns (only if enabled)
  if (generateSequential !== false) {
    const additionalUrls = generateSequentialImages(sequentialPatterns)
    additionalUrls.forEach(url => imageUrls.add(url))
  }

  return Array.from(imageUrls)
}

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico']
  try {
    // Decode URL to handle encoded characters
    let decodedUrl: string
    try {
      decodedUrl = decodeURIComponent(url)
    } catch {
      decodedUrl = url
    }
    
    const lower = decodedUrl.toLowerCase()
    
    // Basic validation - must be a valid URL format
    if (!/^https?:\/\//.test(url)) return false
    
    // Check for malformed URLs with excessive encoding or invalid characters
    if (url.includes('%22') || url.includes('%3A') || url.includes('website%3A')) {
      return false
    }
    
    // Reject URLs containing JSON characters (from structured data)
    if (url.includes('{') || url.includes('}') || url.includes('[') || url.includes(']')) {
      return false
    }
    
    // Check if URL contains suspicious patterns that don't look like real image URLs
    if (lower.includes('primanyreadofpage') || lower.includes('readaction') || lower.includes('potentialaction')) {
      return false
    }
    
    return imageExtensions.some(ext => lower.includes(ext))
  } catch {
    return false
  }
}

function getFileTypeFromUrl(url: string): string | null {
  const match = url.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)(?:[?#].*)?$/)
  return match ? match[1] : null
}

function resolveUrl(url: string, baseUrl: string): string | null {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return new URL(url, baseUrl).href
  } catch {
    return null
  }
}

// Detect sequential patterns in image URLs (for manga sites)
function detectSequentialPattern(url: string, patterns: Set<string>) {
  // Look for numbered patterns like: /001.jpg, /002.jpg, etc.
  const sequentialRegex = REGEX_PATTERNS.SEQUENTIAL_IMAGE
  const match = url.match(sequentialRegex)
  if (match) {
    const [, basePath, , extension] = match
    const pattern = `${basePath}###.${extension}`
    patterns.add(pattern)
  }
}

// Generate additional sequential images based on detected patterns (legacy: keeps for compatibility)
function generateSequentialImages(patterns: Set<string>): string[] {
  const additionalUrls: string[] = []
  
  patterns.forEach(pattern => {
    const [basePath, extension] = pattern.split('###.')
    for (let i = 1; i <= DEFAULTS.SEQUENTIAL_MAX_IMAGES; i++) {
      const paddedNumber = i.toString().padStart(3, '0')
      const url = `${basePath}${paddedNumber}.${extension}`
      additionalUrls.push(url)
    }
  })
  
  return additionalUrls
}

// Strong sequential pattern detection from a list of URLs
export function detectStrongSequentialPattern(urls: string[]): { basePath: string, extension: string, pad: number } | null {
  const map = new Map<string, Set<number>>()
  const padMap = new Map<string, number>()
  const regex = REGEX_PATTERNS.SEQUENTIAL_IMAGE

  for (const url of urls) {
    const m = url.match(regex)
    if (m) {
      const base = m[1]
      const numStr = m[2]
      const ext = m[3]
      const key = base + '||' + ext
      const set = map.get(key) || new Set<number>()
      set.add(parseInt(numStr, 10))
      map.set(key, set)
      padMap.set(key, Math.max(padMap.get(key) || 0, numStr.length))
    }
  }

  for (const [key, set] of map.entries()) {
    const nums = Array.from(set).sort((a, b) => a - b)
    for (let i = 0; i < nums.length - 1; i++) {
      if (nums[i + 1] === nums[i] + 1) {
        const [base, ext] = key.split('||')
        const pad = padMap.get(key) || 3
        return { basePath: base, extension: ext, pad }
      }
    }
  }

  return null
}

