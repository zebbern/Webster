import blink from '../cors/client'

// Simple fetch wrapper using blink API with rate limiting
const fetchData = async (url: string, method: 'GET' | 'HEAD' = 'GET', signal?: AbortSignal, retries = 2) => {
  // Temporarily silence console during fetch to reduce noise
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = () => {}
  console.warn = () => {}
  
  try {
    const fetched = await blink.data.fetch({ url, method, signal })
    if (signal?.aborted) throw new Error('Aborted')
    
    // Handle rate limiting (429) with exponential backoff
    if (fetched.status === 429 && retries > 0) {
      const delay = Math.pow(2, 3 - retries) * 1000 // 1s, 2s delays
      console.log = originalLog // Temporarily restore for this message
      console.warn(`Rate limited (429), retrying in ${delay}ms...`)
      console.log = () => {}
      
      await new Promise(resolve => setTimeout(resolve, delay))
      return fetchData(url, method, signal, retries - 1)
    }
    
    const body = typeof fetched.body === 'string' ? fetched.body : JSON.stringify(fetched.body)
    return { body, status: fetched.status || 200, headers: new Headers() }
  } finally {
    // Restore console
    console.log = originalLog
    console.warn = originalWarn
  }
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

export interface ScrapeProgress {
  stage: 'loading' | 'scanning' | 'analyzing' | 'processing'
  processed: number
  total: number
  found: number
  currentUrl?: string
  // When present, the scraper is reporting a single newly-validated image (live insertion)
  image?: ScrapedImage
}

export interface ScrapeOptions {
  onProgress?: (progress: ScrapeProgress) => void
  signal?: AbortSignal
  // keepAlive behaviour: total time to keep re-scanning (ms)
  keepAliveMs?: number
  // time between re-scan attempts (ms)
  pollIntervalMs?: number
  // how many consecutive empty scans allowed before stopping early
  maxIdleScans?: number
  // If true, prefer sequence-only fast generation and avoid long keep-alive
  preferSequenceOnly?: boolean
  // How many consecutive misses to tolerate when generating sequences (default 3)
  consecutiveMissThreshold?: number
  // How many chapters to fetch (default 1)
  chapterCount?: number
  // Callback for live image insertion
  onNewImage?: (image: ScrapedImage) => void
}

const DEFAULT_KEEP_ALIVE_MS = 8000
const DEFAULT_POLL_INTERVAL_MS = 1500
const DEFAULT_MAX_IDLE_SCANS = 3
const DEFAULT_SEQ_MAX = 50
const DEFAULT_CONSECUTIVE_MISS_THRESHOLD = 3

// Real web scraping using only direct HTML fetch
export const scrapeImages = async (
  url: string,
  fileTypes: string[],
  options: ScrapeOptions = {}
): Promise<ScrapedImage[]> => {
  const { onProgress, signal, onNewImage } = options
  const keepAliveMs = options.keepAliveMs ?? DEFAULT_KEEP_ALIVE_MS
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
  const maxIdleScans = options.maxIdleScans ?? DEFAULT_MAX_IDLE_SCANS
  const preferSequenceOnly = !!options.preferSequenceOnly
  const consecutiveMissThreshold = options.consecutiveMissThreshold ?? DEFAULT_CONSECUTIVE_MISS_THRESHOLD
  const chapterCount = options.chapterCount ?? 1

  // Validate URL
  try {
    new URL(url)
  } catch {
    throw new Error('Invalid URL format')
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://')
  }

  const images: ScrapedImage[] = []
  const seenUrls = new Set<string>()

  onProgress?.({ stage: 'loading', processed: 0, total: 1, found: 0, currentUrl: url })

  try {
    // Initial fetch
    const fetched = await fetchData(url, 'GET', signal)
    if (signal?.aborted) throw new Error('Aborted')
    const body = typeof fetched.body === 'string' ? fetched.body : JSON.stringify(fetched.body)

    onProgress?.({ stage: 'scanning', processed: 0, total: 1, found: 0 })

    // Extract initial candidates
    let imageUrls = extractImageUrls(body, [], url, body)
    imageUrls = Array.from(new Set(imageUrls))

    // Check for strong sequential patterns and if found, optionally generate sequence and stop further polling
    const seqInfo = detectStrongSequentialPattern(imageUrls)
    if (seqInfo) {
      const { basePath, extension, pad } = seqInfo
      let processedCount = 0

      // Multi-chapter support: fetch multiple chapters if requested
      for (let chapter = 0; chapter < chapterCount; chapter++) {
        if (signal?.aborted) throw new Error('Aborted')
        
        // For chapters beyond the first, try to modify the base path
        let currentBasePath = basePath
        if (chapter > 0) {
          // Try to increment chapter number in the path
          const chapterMatch = basePath.match(/(.*\/)([0-9]+)(\/.*)?$/)
          if (chapterMatch) {
            const [, prefix, chapterNum, suffix = ''] = chapterMatch
            const nextChapter = parseInt(chapterNum, 10) + chapter
            currentBasePath = `${prefix}${nextChapter}${suffix}`
          } else {
            // If no chapter pattern found, skip additional chapters
            if (chapter > 0) break
          }
        }

        // Process images in parallel batches for much faster validation
        const BATCH_SIZE = 10
        let consecutiveMisses = 0
        let chapterImageCount = 0
        let currentIndex = 1

        while (currentIndex <= DEFAULT_SEQ_MAX && consecutiveMisses < consecutiveMissThreshold) {
          if (signal?.aborted) throw new Error('Aborted')
          
          // Create batch of candidates
          const batch: string[] = []
          for (let j = 0; j < BATCH_SIZE && (currentIndex + j) <= DEFAULT_SEQ_MAX; j++) {
            const padded = (currentIndex + j).toString().padStart(pad, '0')
            const candidate = `${currentBasePath}${padded}.${extension}`
            if (!seenUrls.has(candidate)) {
              batch.push(candidate)
            }
          }

          // Process batch in parallel
          const batchPromises = batch.map(async (candidate) => {
            try {
              const res = await fetchData(candidate, 'HEAD', signal)
              const status = res?.status ?? 200
              return { candidate, success: status < 400 }
            } catch (err) {
              return { candidate, success: false }
            }
          })

          const batchResults = await Promise.all(batchPromises)
          let batchHasSuccess = false
          
          for (const result of batchResults) {
            if (result.success) {
              batchHasSuccess = true
              consecutiveMisses = 0
              chapterImageCount++
              seenUrls.add(result.candidate)
              processedCount++
              
              const newImage: ScrapedImage = { 
                url: result.candidate, 
                type: extension, 
                source: 'static', 
                alt: `Image from ${new URL(url).hostname} - Chapter ${chapter + 1}` 
              }
              images.push(newImage)

              // Live insertion
              onNewImage?.(newImage)
              onProgress?.({ 
                stage: 'scanning', 
                processed: processedCount, 
                total: DEFAULT_SEQ_MAX * chapterCount, 
                found: images.length, 
                currentUrl: result.candidate, 
                image: newImage 
              })
            }
          }

          if (!batchHasSuccess) {
            consecutiveMisses += BATCH_SIZE
          }

          currentIndex += BATCH_SIZE
        }

        // Continue to next chapter even if this one had no images (unless it's the first chapter)
        // Only stop if we're beyond the first chapter and found no images
        if (chapterImageCount === 0 && chapter === 0) {
          // If first chapter has no images, stop entirely
          break
        }
      }

      // Skip metadata enrichment to avoid unnecessary CORS requests
      // User already has all the images they need at this point

      return images
    }

    // If preferSequenceOnly was requested but no sequence found, and user prefers this fast mode, return early empty
    if (preferSequenceOnly && !seqInfo) {
      return []
    }

    // Process discovered URLs (dedupe and filter by type)
    let processedCount = 0
    for (const imageUrl of imageUrls) {
      if (signal?.aborted) throw new Error('Aborted')
      if (!imageUrl) continue
      if (seenUrls.has(imageUrl)) continue
      seenUrls.add(imageUrl)

      const type = getFileTypeFromUrl(imageUrl)
      processedCount++

      if (!type || !fileTypes.includes(type)) {
        onProgress?.({ stage: 'scanning', processed: processedCount, total: imageUrls.length, found: images.length, currentUrl: imageUrl })
        continue
      }

      const newImage: ScrapedImage = { url: imageUrl, type, source: 'dynamic', alt: `Image from ${new URL(url).hostname}` }
      images.push(newImage)

      // Live insertion: call onNewImage immediately when image is discovered
      onNewImage?.(newImage)

      // Live insertion: report this newly discovered image immediately
      onProgress?.({ stage: 'scanning', processed: processedCount, total: imageUrls.length, found: images.length, currentUrl: imageUrl, image: newImage })

      // small throttle so progress UI updates smoothly
      await new Promise(res => setTimeout(res, 10))
    }

    // Keep-alive: periodically re-fetch the page to discover images that may be added later
    const startTime = Date.now()
    let idleScans = 0

    onProgress?.({ stage: 'analyzing', processed: images.length, total: images.length || 1, found: images.length })

    while (!signal?.aborted && (Date.now() - startTime) < keepAliveMs && idleScans < maxIdleScans) {
      // wait before next scan
      await new Promise(res => setTimeout(res, pollIntervalMs))
      if (signal?.aborted) throw new Error('Aborted')

      // fetch again
      try {
        const reFetch = await fetchData(url, 'GET', signal)
        if (signal?.aborted) throw new Error('Aborted')
        const reBody = typeof reFetch.body === 'string' ? reFetch.body : JSON.stringify(reFetch.body)

        onProgress?.({ stage: 'analyzing', processed: images.length, total: images.length || 1, found: images.length, currentUrl: url })

        const newlyFoundUrls = extractImageUrls(reBody, [], url, reBody)
        let newAdded = 0
        for (const candidate of newlyFoundUrls) {
          if (signal?.aborted) throw new Error('Aborted')
          if (!candidate) continue
          if (seenUrls.has(candidate)) continue
          const type = getFileTypeFromUrl(candidate)
          if (!type || !fileTypes.includes(type)) continue
          seenUrls.add(candidate)
          const newImage: ScrapedImage = { url: candidate, type, source: 'dynamic', alt: `Image from ${new URL(url).hostname}` }
          images.push(newImage)
          newAdded++

          // Live insertion: call onNewImage immediately
          onNewImage?.(newImage)

          // Report new incremental image
          onProgress?.({ stage: 'analyzing', processed: images.length, total: images.length, found: images.length, currentUrl: candidate, image: newImage })
          await new Promise(res => setTimeout(res, 10))
        }

        if (newAdded === 0) {
          idleScans++
        } else {
          // reset idle scans so we keep watching for further additions
          idleScans = 0
        }
      } catch (err) {
        console.warn('re-fetch failed during keep-alive', err)
        idleScans++
      }
    }

    // Skip metadata enrichment to avoid unnecessary CORS requests after scraping is done
    // User already has all the image URLs they need

    return images
  } catch (error: any) {
    if (error.message === 'Aborted' || options.signal?.aborted) throw new Error('Aborted')
    console.warn('Direct fetch failed in advancedImageScraper:', error)
    return []
  }
}

// Extract image URLs from scraped content (robust checks)
function extractImageUrls(markdown: string, links: any[], baseUrl: string, extract: any = null): string[] {
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
    const markdownImageRegex = /!\[.*?\]\((.*?)\)/g
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
    const imgTagRegex = /<img[^>]+>/gi
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
    }
  }

  // 4) Plain text URLs in markdown
  if (typeof markdown === 'string') {
    const plainUrlRegex = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg|bmp|tiff|ico)/gi
    let pu
    while ((pu = plainUrlRegex.exec(markdown)) !== null) tryAdd(pu[0])
  }

  // 5) Generate additional sequential images based on detected patterns
  const additionalUrls = generateSequentialImages(sequentialPatterns)
  additionalUrls.forEach(url => imageUrls.add(url))

  return Array.from(imageUrls)
}

function isImageUrl(url: string): boolean {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff', '.ico']
  try {
    const lower = url.toLowerCase()
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
  const sequentialRegex = /^(.*\/)([0-9]{2,4})\.(jpg|jpeg|png|gif|webp)$/i
  const match = url.match(sequentialRegex)
  if (match) {
    const [, basePath, numberStr, extension] = match
    const pattern = `${basePath}###.${extension}`
    patterns.add(pattern)
  }
}

// Generate additional sequential images based on detected patterns (legacy: keeps for compatibility)
function generateSequentialImages(patterns: Set<string>): string[] {
  const additionalUrls: string[] = []
  
  patterns.forEach(pattern => {
    const [basePath, extension] = pattern.split('###.')
    for (let i = 1; i <= 50; i++) {
      const paddedNumber = i.toString().padStart(3, '0')
      const url = `${basePath}${paddedNumber}.${extension}`
      additionalUrls.push(url)
    }
  })
  
  return additionalUrls
}

// Strong sequential pattern detection from a list of URLs
function detectStrongSequentialPattern(urls: string[]): { basePath: string, extension: string, pad: number } | null {
  const map = new Map<string, Set<number>>()
  const padMap = new Map<string, number>()
  const regex = /^(.*\/)([0-9]{2,4})\.(jpg|jpeg|png|gif|webp)$/i

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

async function getImageMetadata(imageUrl: string): Promise<Partial<ScrapedImage> | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    const timeout = setTimeout(() => resolve(null), 4000)
    img.onload = () => {
      clearTimeout(timeout)
      resolve({ dimensions: { width: img.naturalWidth, height: img.naturalHeight } })
    }
    img.onerror = () => {
      clearTimeout(timeout)
      resolve(null)
    }
    img.src = imageUrl
  })
}
