interface FetchResponse {
  status: number
  body: string | null
  headers: Record<string, string>
  encoding?: string
}

class VercelClient {
  private baseUrl: string

  constructor() {
    // Use relative path for API routes when deployed
    this.baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  }

  async fetch(options: { url: string; method?: 'GET' | 'HEAD'; signal?: AbortSignal }): Promise<FetchResponse> {
    const { url, method = 'GET', signal } = options

    try {
      const apiUrl = `${this.baseUrl}/api/fetch`
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, method }),
        signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data: FetchResponse = await response.json()
      return data
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Aborted')
      }
      throw error
    }
  }
}

// Create client instance
const vercelClient = new VercelClient()

// Export with same interface as blink client
export default {
  data: {
    fetch: vercelClient.fetch.bind(vercelClient)
  }
}