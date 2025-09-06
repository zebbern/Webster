type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug'

interface ConsoleBackup {
  log: typeof console.log
  warn: typeof console.warn
  error: typeof console.error
  info: typeof console.info
  debug: typeof console.debug
}

class ConsoleManager {
  private backup: ConsoleBackup | null = null
  private isSilenced: boolean = false

  /**
   * Temporarily silence specified console methods to reduce noise
   */
  silence(methods: ConsoleMethod[] = ['log', 'warn']): void {
    if (this.isSilenced) return

    this.backup = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    }

    methods.forEach(method => {
      ;(console as any)[method] = () => {}
    })

    this.isSilenced = true
  }

  /**
   * Restore console methods to their original state
   */
  restore(): void {
    if (!this.isSilenced || !this.backup) return

    console.log = this.backup.log
    console.warn = this.backup.warn
    console.error = this.backup.error
    console.info = this.backup.info
    console.debug = this.backup.debug

    this.backup = null
    this.isSilenced = false
  }

  /**
   * Temporarily restore console for a single message, then re-silence
   */
  temporaryRestore<T>(method: ConsoleMethod, callback: () => T): T {
    if (!this.isSilenced || !this.backup) {
      return callback()
    }

    const originalMethod = (console as any)[method]
    ;(console as any)[method] = (this.backup as any)[method]
    
    try {
      return callback()
    } finally {
      ;(console as any)[method] = originalMethod
    }
  }

  /**
   * Check if console is currently silenced
   */
  get silenced(): boolean {
    return this.isSilenced
  }
}

// Export singleton instance
export const consoleManager = new ConsoleManager()

// Convenience functions for common use cases
export const silenceConsole = (methods?: ConsoleMethod[]): void => {
  consoleManager.silence(methods)
}

export const restoreConsole = (): void => {
  consoleManager.restore()
}

export const withSilencedConsole = async <T>(
  operation: () => Promise<T>,
  methods?: ConsoleMethod[]
): Promise<T> => {
  consoleManager.silence(methods)
  try {
    return await operation()
  } finally {
    consoleManager.restore()
  }
}

export const withTemporaryConsole = <T>(
  method: ConsoleMethod,
  callback: () => T
): T => {
  return consoleManager.temporaryRestore(method, callback)
}

// Production mode utility (enhanced from original)
let isProductionMode = false

export const enableProductionMode = () => {
  if (isProductionMode) return
  isProductionMode = true

  const originalError = console.error
  const originalWarn = console.warn
  
  // Filter cookie-related noise and development warnings
  console.error = (...args) => {
    const message = args.join(' ')
    if (
      message.includes('Cookie') ||
      message.includes('SameSite') ||
      message.includes('cross-site')
    ) {
      return
    }
    originalError(...args)
  }

  console.warn = (...args: any[]) => {
    const message = args[0]?.toString() || ''
    
    // Filter out common React development warnings
    if (
      message.includes('React.StrictMode') ||
      message.includes('Warning: ') ||
      message.includes('validateDOMNesting') ||
      message.includes('findDOMNode') ||
      message.includes('componentWillMount') ||
      message.includes('componentWillReceiveProps') ||
      message.includes('componentWillUpdate')
    ) {
      return // Suppress these warnings
    }
    
    // Show other warnings normally
    originalWarn.apply(console, args)
  }
}

export const disableProductionMode = () => {
  isProductionMode = false
}