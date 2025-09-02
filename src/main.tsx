import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { enableProductionMode } from './utils/consoleUtils'

// Enable production mode to reduce console noise (in both dev and production)
enableProductionMode()

// Add loading state management to prevent FOUC
const root = ReactDOM.createRoot(document.getElementById('root')!)

// Add loaded class after React renders to fade in content
const rootElement = document.getElementById('root')!

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Add loaded class after initial render to trigger fade-in
requestAnimationFrame(() => {
  rootElement.classList.add('loaded')
}) 