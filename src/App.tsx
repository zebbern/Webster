import React from 'react'
import ImageScraper from './components/ImageScraper'
import { ThemeProvider } from './providers/ThemeProvider'
import { TooltipProvider } from './components/ui/tooltip'
import './index.css'
import { Toaster } from 'sonner'

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="image-scraper-theme">
      <TooltipProvider>
        <div className="min-h-screen bg-background transition-colors">
          <ImageScraper />
          <Toaster richColors position="top-right" />
        </div>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App