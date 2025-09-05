/**
 * URL Pattern utility for website-specific chapter URL generation
 */

interface UrlConfig {
  url: string
  config: string
  variables: Record<string, string>
}

interface ParsedPattern {
  template: string
  variables: Record<string, string>
  hasChapterVar: boolean
  domain: string
  hasPadding?: boolean
  paddingLength?: number
}

class UrlPatternManager {
  private configs: Map<string, ParsedPattern> = new Map()

  constructor() {
    this.loadConfigsFromEnv()
  }

  private loadConfigsFromEnv() {
    try {
      // Parse the new .env format
      const envContent = this.getEnvContent()
      const configs = this.parseEnvContent(envContent)
      
      configs.forEach(config => {
        const domain = new URL(config.url).hostname
        this.configs.set(domain, {
          template: config.config,
          variables: config.variables,
          hasChapterVar: this.hasChapterVariable(config.config, config.variables),
          domain: domain
        })
      })
    } catch (error) {
      console.warn('Failed to load URL configs from environment:', error)
      this.loadFallbackPatterns()
    }

    if (this.configs.size === 0) {
      this.loadFallbackPatterns()
    }
  }

  private getEnvContent(): string {
    // Try to get env content from various sources
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // In Vite, we need to reconstruct the .env content from individual variables
      return this.reconstructEnvFromVite(import.meta.env)
    }
    
    // Fallback: return empty and use fallback patterns
    return ''
  }

  private reconstructEnvFromVite(env: any): string {
    // Reconstruct .env content from VITE_ prefixed variables
    const envContent: string[] = []
    const configGroups: Map<string, Record<string, string>> = new Map()
    
    // Group variables by their numeric suffix
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string' && key.startsWith('VITE_')) {
        const match = key.match(/^VITE_(.+?)_(\d+)$/)
        if (match) {
          const [, varName, groupId] = match
          if (!configGroups.has(groupId)) {
            configGroups.set(groupId, {})
          }
          configGroups.get(groupId)![varName.toLowerCase()] = value
        }
      }
    }
    
    // Convert grouped variables back to .env format
    for (const [, vars] of configGroups.entries()) {
      if (vars.url && vars.config) {
        envContent.push(`url=${vars.url}`)
        envContent.push(`config=${vars.config}`)
        
        // Add other variables
        for (const [key, value] of Object.entries(vars)) {
          if (key !== 'url' && key !== 'config') {
            envContent.push(`${key}=${value}`)
          }
        }
        envContent.push('') // Empty line between configs
      }
    }
    
    return envContent.join('\n')
  }

  public parseEnvContent(content: string): UrlConfig[] {
    const configs: UrlConfig[] = []
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    
    let currentConfig: Partial<UrlConfig> = {}
    let currentVariables: Record<string, string> = {}
    
    for (const line of lines) {
      const [key, value] = line.split('=', 2)
      if (!key || !value) continue
      
      const trimmedKey = key.trim()
      const trimmedValue = value.trim()
      
      if (trimmedKey === 'url') {
        // Start of new config
        if (currentConfig.url && currentConfig.config) {
          configs.push({
            url: currentConfig.url,
            config: currentConfig.config,
            variables: { ...currentVariables }
          })
        }
        currentConfig = { url: trimmedValue }
        currentVariables = {}
      } else if (trimmedKey === 'config') {
        currentConfig.config = trimmedValue
      } else {
        // Variable definition
        currentVariables[trimmedKey] = trimmedValue
      }
    }
    
    // Add the last config
    if (currentConfig.url && currentConfig.config) {
      configs.push({
        url: currentConfig.url,
        config: currentConfig.config,
        variables: { ...currentVariables }
      })
    }
    
    return configs
  }

  private hasChapterVariable(template: string, variables: Record<string, string>): boolean {
    // Check if template or variables reference chapter-related patterns
    return template.includes('{ch_') || 
           Object.keys(variables).some(key => key.includes('ch_')) ||
           Object.values(variables).some(value => value.includes('{n'))
  }



  private loadFallbackPatterns() {
    // Built-in patterns for common sites
    this.configs.set('example.com', {
      template: '/manhua/example-chapter-{ch_count}-ch{ch_next}',
      variables: { ch_count: '{n+1}', ch_next: '{n+1}' },
      hasChapterVar: true,
      domain: 'example.com'
    })
    this.configs.set('manga-site.org', {
      template: '/chapter/{ch_count}',
      variables: { ch_count: '{n+1}' },
      hasChapterVar: true,
      domain: 'manga-site.org'
    })
    this.configs.set('comic-reader.net', {
      template: '/comics/title/ch-{ch_count:03d}',
      variables: { ch_count: '{n+1}' },
      hasChapterVar: true,
      domain: 'comic-reader.net'
    })
  }


  /**
   * Generate chapter URL for a specific website
   */
  public generateChapterUrl(baseUrl: string, chapterNumber: number): string | null {
    try {
      const url = new URL(baseUrl)
      const domain = url.hostname
      
      // Try site-specific pattern first
      const siteConfig = this.configs.get(domain)
      if (siteConfig) {
        return this.applyConfigPattern(url, siteConfig, chapterNumber)
      }

      // Fallback to automatic detection
      return this.generateUrlWithAutoDetection(baseUrl, chapterNumber)
    } catch (error) {
      console.warn('Failed to generate chapter URL:', error)
      return null
    }
  }

  private applyConfigPattern(baseUrl: URL, config: ParsedPattern, chapterNumber: number): string | null {
    try {
      let result = config.template
      
      // First, evaluate variables with {n+1} or similar expressions
      const evaluatedVariables: Record<string, string> = {}
      for (const [key, value] of Object.entries(config.variables)) {
        if (value.includes('{n+1}')) {
          evaluatedVariables[key] = chapterNumber.toString()
        } else if (value.includes('{n}')) {
          evaluatedVariables[key] = (chapterNumber - 1).toString()
        } else {
          evaluatedVariables[key] = value
        }
      }
      
      // Replace variable placeholders with evaluated values
      for (const [key, value] of Object.entries(evaluatedVariables)) {
        const regex = new RegExp(`\\{${key}\\}`, 'g')
        result = result.replace(regex, value)
      }
      
      // Handle wildcards by preserving existing path segments
      if (result.includes('{*}')) {
        const pathSegments = baseUrl.pathname.split('/').filter(segment => segment.length > 0)
        let wildcardIndex = 0
        result = result.replace(/\{\*\}/g, () => {
          return pathSegments[wildcardIndex++] || ''
        })
      }
      
      // If template starts with full URL, use it directly
      if (result.startsWith('http')) {
        return result
      }
      
      // Build final URL with base domain
      const finalUrl = new URL(baseUrl)
      finalUrl.pathname = result.startsWith('/') ? result : '/' + result
      return finalUrl.toString()
    } catch (error) {
      console.warn('Failed to apply config pattern:', error)
      return null
    }
  }



  private generateUrlWithAutoDetection(baseUrl: string, chapterNumber: number): string | null {
    // Fallback to the original auto-detection logic
    try {
      const url = new URL(baseUrl)
      const pathSegments = url.pathname.split('/').filter(segment => segment.length > 0)
      let urlModified = false
      
      for (let i = pathSegments.length - 1; i >= 0; i--) {
        const segment = pathSegments[i]
        
        // Look for chapter patterns
        const chapterMatch = segment.match(/^(.*?)(\d+)(.*)$/)
        if (chapterMatch) {
          const [, prefix, numberStr, suffix] = chapterMatch
          const currentNum = parseInt(numberStr, 10)
          const newNum = currentNum + (chapterNumber - currentNum)
          const paddedNum = numberStr.startsWith('0') ? newNum.toString().padStart(numberStr.length, '0') : newNum.toString()
          pathSegments[i] = `${prefix}${paddedNum}${suffix}`
          urlModified = true
          break
        }
      }
      
      if (urlModified) {
        const newUrl = new URL(url)
        newUrl.pathname = '/' + pathSegments.join('/') + (baseUrl.endsWith('/') ? '/' : '')
        return newUrl.toString()
      }
    } catch (error) {
      console.warn('Auto-detection failed:', error)
    }
    
    return null
  }

  /**
   * Get available patterns for debugging
   */
  public getPatterns(): { domain: string; pattern: string }[] {
    return Array.from(this.configs.entries()).map(([domain, config]) => ({
      domain,
      pattern: config.template
    }))
  }

  /**
   * Debug: Test pattern generation for a URL
   */
  public debugPatternGeneration(url: string, chapterNumber: number): {
    originalUrl: string;
    domain: string;
    hasCustomPattern: boolean;
    generatedUrl: string | null;
    extractedChapter: number | null;
  } {
    const urlObj = new URL(url)
    const domain = urlObj.hostname
    const extractedChapter = extractChapterNumber(url)
    const hasCustomPattern = this.hasPatternFor(domain)
    const generatedUrl = this.generateChapterUrl(url, chapterNumber)

    return {
      originalUrl: url,
      domain,
      hasCustomPattern,
      generatedUrl,
      extractedChapter
    }
  }

  /**
   * Check if a domain has a specific pattern configured
   */
  public hasPatternFor(domain: string): boolean {
    return this.configs.has(domain)
  }

  /**
   * Import patterns from .env format string
   */
  public importFromEnvFormat(envContent: string): void {
    const configs = this.parseEnvContent(envContent)
    
    configs.forEach(config => {
      const domain = new URL(config.url).hostname
      this.configs.set(domain, {
        template: config.config,
        variables: config.variables,
        hasChapterVar: this.hasChapterVariable(config.config, config.variables),
        domain: domain
      })
    })
  }

  /**
   * Export current patterns to .env format string
   */
  public exportToEnvFormat(): string {
    return this.reconstructEnvFromConfigs()
  }

  private reconstructEnvFromConfigs(): string {
    const envContent: string[] = []
    
    for (const [domain, pattern] of this.configs.entries()) {
      envContent.push(`# ${domain}`)
      envContent.push(`url=https://${domain}/example`)
      envContent.push(`config=${pattern.template}`)
      
      // Add variables if any
      for (const [key, value] of Object.entries(pattern.variables)) {
        envContent.push(`${key}=${value}`)
      }
      
      envContent.push('') // Empty line between configs
    }

    return envContent.join('\n')
  }
}

// Singleton instance
export const urlPatternManager = new UrlPatternManager()

