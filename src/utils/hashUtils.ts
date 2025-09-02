export async function computeImageHash(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const buffer = await resp.arrayBuffer()
    // Use SHA-1 for short hash - good balance for dedupe
    const digest = await crypto.subtle.digest('SHA-1', buffer)
    const hashArray = Array.from(new Uint8Array(digest))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex
  } catch (err) {
    // Silent fail to reduce console noise
    return null
  }
}

export async function computeHashesConcurrently(urls: string[], concurrency = 4): Promise<(string | null)[]> {
  const results: (string | null)[] = new Array(urls.length).fill(null)
  let idx = 0

  async function worker() {
    while (idx < urls.length) {
      const i = idx++
      results[i] = await computeImageHash(urls[i])
    }
  }

  const workers = new Array(Math.min(concurrency, urls.length)).fill(0).map(() => worker())
  await Promise.all(workers)
  return results
}