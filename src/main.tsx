import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { enableProductionMode } from './utils/consoleUtils'

// Enable production mode to reduce console noise (in both dev and production)
enableProductionMode()

// Add loading state management to prevent FOUC
const root = ReactDOM.createRoot(document.getElementById('root')!)
const rootElement = document.getElementById('root')!

// Wait for stylesheets to load before showing content
const waitForStylesheets = () => {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'complete') {
      resolve()
      return
    }

    // Check if all stylesheets are loaded
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    let loadedCount = 0
    
    const checkAllLoaded = () => {
      loadedCount++
      if (loadedCount >= stylesheets.length) {
        resolve()
      }
    }

    if (stylesheets.length === 0) {
      // No external stylesheets, wait for DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => resolve())
      } else {
        resolve()
      }
    } else {
      // Wait for all stylesheets to load
      stylesheets.forEach((link) => {
        if ((link as HTMLLinkElement).sheet) {
          checkAllLoaded()
        } else {
          link.addEventListener('load', checkAllLoaded)
          link.addEventListener('error', checkAllLoaded) // Handle failed loads
        }
      })
    }
  })
}

// Render React app
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Wait for both React render and CSS load before showing content
Promise.all([
  new Promise(resolve => requestAnimationFrame(resolve)),
  waitForStylesheets()
]).then(() => {
  // Add small delay to ensure everything is painted
  setTimeout(() => {
    rootElement.classList.add('loaded')
  }, 50)
}) 