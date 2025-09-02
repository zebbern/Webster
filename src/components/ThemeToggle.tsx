import React from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '../providers/ThemeProvider'

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme()

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-5 w-5" />
      case 'dark':
        return <Moon className="h-5 w-5" />
      default:
        return <Monitor className="h-5 w-5" />
    }
  }

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light mode'
      case 'dark':
        return 'Dark mode'
      default:
        return 'System theme'
    }
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg bg-card hover:bg-muted transition-colors border border-border"
      title={getLabel()}
      aria-label={getLabel()}
    >
      {getIcon()}
    </button>
  )
}

export default ThemeToggle