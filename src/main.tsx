import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { enableProductionMode } from './utils/consoleUtils'

// Enable production mode to reduce console noise (in both dev and production)
enableProductionMode()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 