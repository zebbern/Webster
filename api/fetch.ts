import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url, method = 'GET' } = req.method === 'GET' ? req.query : req.body

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL parameter is required' })
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }

    const fetchOptions: RequestInit = {
      method: method as string,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageScraper/1.0)',
        'Accept': method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    }

    const response = await fetch(url, fetchOptions)
    
    if (method === 'HEAD') {
      // For HEAD requests, just return status and headers
      const headers: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        headers[key] = value
      })

      return res.status(response.status).json({
        status: response.status,
        headers,
        body: null
      })
    }

    // For GET requests, return the content
    const contentType = response.headers.get('content-type') || 'text/plain'
    
    if (contentType.includes('text/') || contentType.includes('application/json') || contentType.includes('application/xml')) {
      const body = await response.text()
      return res.status(response.status).json({
        status: response.status,
        body,
        headers: Object.fromEntries(response.headers.entries())
      })
    } else {
      // For binary content, return base64
      const buffer = await response.arrayBuffer()
      const body = Buffer.from(buffer).toString('base64')
      return res.status(response.status).json({
        status: response.status,
        body,
        headers: Object.fromEntries(response.headers.entries()),
        encoding: 'base64'
      })
    }

  } catch (error) {
    console.error('Fetch error:', error)
    
    // Check for timeout errors
    if (error instanceof Error && error.name === 'TimeoutError') {
      return res.status(408).json({ error: 'Request timeout (5 seconds)', type: 'timeout' })
    }
    
    // Check for network/fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return res.status(500).json({ error: 'Failed to fetch URL', type: 'network' })
    }
    
    // Check for abort errors
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(408).json({ error: 'Request was aborted', type: 'abort' })
    }
    
    return res.status(500).json({ error: 'Internal server error', type: 'unknown' })
  }
}