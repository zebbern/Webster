export interface WebsitePattern {
  id: string
  name: string
  domain: string
  description: string
  urlPattern: string
  chapterConfig: string
  example: string
}

export const PREDEFINED_WEBSITE_PATTERNS: WebsitePattern[] = [
  {
    id: 'auto-detect',
    name: 'Auto-Detect',
    domain: '',
    description: 'Automatically analyze the URL and detect chapter navigation pattern',
    urlPattern: '',
    chapterConfig: '',
    example: 'Analyzes current URL structure to find chapter patterns automatically'
  },
  {
    id: 'manhuato',
    name: 'ManhuaTO',
    domain: 'manhuato.com',
    description: 'Popular manga/manhua reading site',
    urlPattern: 'https://manhuato.com/{*}/{*}chapter-{ch_count}-ch{ch_next}',
    chapterConfig: '{n+1}',
    example: 'https://manhuato.com/manga/title/chapter-1-ch2'
  },
  {
    id: 'manhuaus',
    name: 'ManhuaUS', 
    domain: 'manhuaus.com',
    description: 'Manga and manhua reader',
    urlPattern: 'https://manhuaus.com/{*}/{*}/chapter-{ch_next}/',
    chapterConfig: '{n+1}',
    example: 'https://manhuaus.com/manga/title/chapter-2/'
  },
  {
    id: 'manhuaus-org',
    name: 'ManhuaUS (.org)', 
    domain: 'manhuaus.org',
    description: 'Manga and manhua reader (.org domain)',
    urlPattern: 'https://manhuaus.org/{*}/{*}/chapter-{ch_next}/',
    chapterConfig: '{n+1}',
    example: 'https://manhuaus.org/manga/title/chapter-2/'
  },
  {
    id: 'manhuaplus',
    name: 'ManhuaPlus',
    domain: 'manhuaplus.org',
    description: 'Manga and manhua reading platform',
    urlPattern: 'https://manhuaplus.org/{*}/{*}/chapter-{ch_next}',
    chapterConfig: '{n+1}',
    example: 'https://manhuaplus.org/manga/title/chapter-203'
  },
  {
    id: 'manhuaplus-cdn',
    name: 'ManhuaPlus CDN',
    domain: 'cdn.manhuaplus.cc',
    description: 'ManhuaPlus image CDN with timestamped paths',
    urlPattern: 'https://cdn.manhuaplus.cc/{date}/{time}/{timestamp}.webp',
    chapterConfig: 'discovery',
    example: 'https://cdn.manhuaplus.cc/2025/03/19/11-42-08-6911922306357488.webp'
  },
  {
    id: 'manhuaus2',
    name: 'manhuaus.com 2',
    domain: 'img.manhuaus.com',
    description: 'ManhuaUS image server pattern',
    urlPattern: 'https://img.manhuaus.com/image/{*}/{*}/0{ch_next}',
    chapterConfig: '{n+1}',
    example: 'https://img.manhuaus.com/image/manga/title/0201'
  },
  {
    id: 'mangakakalot',
    name: 'MangaKakalot',
    domain: 'mangakakalot.com',
    description: 'Popular manga reading platform',
    urlPattern: 'https://mangakakalot.com/{*}/chapter-{chapter}',
    chapterConfig: '{n}',
    example: 'https://mangakakalot.com/manga/title/chapter-1'
  },
  {
    id: 'mangadex',
    name: 'MangaDex',
    domain: 'mangadex.org',
    description: 'International manga reader',
    urlPattern: 'https://mangadex.org/chapter/{chapter_id}',
    chapterConfig: '{uuid}',
    example: 'https://mangadex.org/chapter/abc-123-def-456'
  },
  {
    id: 'webtoon',
    name: 'LINE Webtoon',
    domain: 'webtoons.com',
    description: 'Official webtoon platform',
    urlPattern: 'https://www.webtoons.com/{lang}/genre/title/episode-{episode}/viewer',
    chapterConfig: '{n}',
    example: 'https://www.webtoons.com/en/romance/title/episode-1/viewer'
  },
  {
    id: 'readm',
    name: 'ReadM',
    domain: 'readm.org',
    description: 'Manga reader with clean interface',
    urlPattern: 'https://www.readm.org/manga/{title}/{chapter}',
    chapterConfig: '{n}',
    example: 'https://www.readm.org/manga/title/1'
  },
  {
    id: 'kissmanga',
    name: 'KissManga',
    domain: 'kissmanga.org',
    description: 'Classic manga reading site',
    urlPattern: 'https://kissmanga.org/manga/{title}/chapter-{chapter}',
    chapterConfig: '{n}',
    example: 'https://kissmanga.org/manga/title/chapter-1'
  },
  {
    id: 'mangapark',
    name: 'MangaPark',
    domain: 'mangapark.net',
    description: 'Multi-language manga platform',
    urlPattern: 'https://mangapark.net/manga/{title}/i{chapter_id}',
    chapterConfig: '{n}',
    example: 'https://mangapark.net/manga/title/i123456'
  },
  {
    id: 'mangahere',
    name: 'MangaHere',
    domain: 'mangahere.cc',
    description: 'Long-running manga site',
    urlPattern: 'https://www.mangahere.cc/manga/{title}/c{chapter:03d}/',
    chapterConfig: '{n}',
    example: 'https://www.mangahere.cc/manga/title/c001/'
  },
  {
    id: 'custom',
    name: 'Custom Pattern',
    domain: '',
    description: 'Define your own custom URL pattern',
    urlPattern: '',
    chapterConfig: '',
    example: 'Enter your own pattern configuration'
  }
]

export function convertToEnvFormat(pattern: WebsitePattern): string {
  if (pattern.id === 'custom') {
    return `# Custom pattern - configure manually below\n`
  }
  
  return `# ${pattern.name} - ${pattern.description}
VITE_URL_${pattern.id.toUpperCase()}=${pattern.domain}
VITE_CONFIG_${pattern.id.toUpperCase()}=${pattern.urlPattern}
VITE_CH_NEXT_${pattern.id.toUpperCase()}=${pattern.chapterConfig}

`
}

export function detectWebsitePattern(url: string): WebsitePattern | null {
  if (!url) return null
  
  try {
    const domain = new URL(url).hostname.replace('www.', '')
    return PREDEFINED_WEBSITE_PATTERNS.find(pattern => 
      pattern.domain && domain.includes(pattern.domain)
    ) || null
  } catch {
    return null
  }
}

export function autoDetectUrlPattern(url: string): WebsitePattern | null {
  if (!url) return null
  
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.replace('www.', '')
    const path = urlObj.pathname
    
    // Common chapter patterns to detect
    const chapterPatterns = [
      // Pattern: /manga/title/chapter-123 or /manga/title/chapter-123-name
      {
        regex: /\/([^\/]+)\/([^\/]+)\/chapter-(\d+)(?:-[^\/]*)?/,
        template: (match: RegExpMatchArray) => `https://${domain}/${match[1]}/${match[2]}/chapter-{chapter}`,
        config: '{n}'
      },
      // Pattern: /manga/title/c123 or /manga/title/c123.html
      {
        regex: /\/([^\/]+)\/([^\/]+)\/c(\d+)(?:\.html?)?/,
        template: (match: RegExpMatchArray) => `https://${domain}/${match[1]}/${match[2]}/c{chapter}`,
        config: '{n}'
      },
      // Pattern: /read/title/123 or /read/title/123/
      {
        regex: /\/read\/([^\/]+)\/(\d+)\/?/,
        template: (match: RegExpMatchArray) => `https://${domain}/read/${match[1]}/{chapter}`,
        config: '{n}'
      },
      // Pattern: /title/123 or /title/123.html
      {
        regex: /\/([^\/]+)\/(\d+)(?:\.html?)?/,
        template: (match: RegExpMatchArray) => `https://${domain}/${match[1]}/{chapter}`,
        config: '{n}'
      },
      // Pattern: /manga/title/vol-1/ch-123
      {
        regex: /\/([^\/]+)\/([^\/]+)\/vol-\d+\/ch-(\d+)/,
        template: (match: RegExpMatchArray) => `https://${domain}/${match[1]}/${match[2]}/vol-1/ch-{chapter}`,
        config: '{n}'
      },
      // Pattern: /series/title/episode-123
      {
        regex: /\/series\/([^\/]+)\/episode-(\d+)/,
        template: (match: RegExpMatchArray) => `https://${domain}/series/${match[1]}/episode-{chapter}`,
        config: '{n}'
      },
      // Pattern: /webtoon/title/123/viewer
      {
        regex: /\/webtoon\/([^\/]+)\/(\d+)\/viewer/,
        template: (match: RegExpMatchArray) => `https://${domain}/webtoon/${match[1]}/{chapter}/viewer`,
        config: '{n}'
      }
    ]
    
    // Try to match against patterns
    for (const pattern of chapterPatterns) {
      const match = path.match(pattern.regex)
      if (match) {
        const urlPattern = pattern.template(match)
        const chapterNumber = parseInt(match[match.length - 1])
        
        return {
          id: 'auto-detected',
          name: 'Auto-Detected Pattern',
          domain: domain,
          description: `Detected pattern from ${domain}`,
          urlPattern: urlPattern,
          chapterConfig: pattern.config,
          example: urlPattern.replace('{chapter}', chapterNumber.toString())
        }
      }
    }
    
    // If no specific pattern found, create a generic one
    const genericChapterMatch = path.match(/(\d+)/)
    if (genericChapterMatch) {
      const chapterNumber = genericChapterMatch[1]
      const genericPattern = url.replace(chapterNumber, '{chapter}')
      
      return {
        id: 'auto-detected-generic',
        name: 'Generic Auto-Detected',
        domain: domain,
        description: `Generic pattern detected from ${domain}`,
        urlPattern: genericPattern,
        chapterConfig: '{n}',
        example: url
      }
    }
    
    return null
  } catch {
    return null
  }
}