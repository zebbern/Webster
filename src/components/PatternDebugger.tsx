import React, { useState } from 'react'
import { urlPatternManager } from '../utils/urlPatterns'
import { Info, Eye, EyeOff } from 'lucide-react'

interface PatternDebuggerProps {
  currentUrl: string
}

const PatternDebugger: React.FC<PatternDebuggerProps> = ({ currentUrl }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [testChapter, setTestChapter] = useState(2)

  if (!currentUrl) return null

  const debugInfo = urlPatternManager.debugPatternGeneration(currentUrl, testChapter)
  const availablePatterns = urlPatternManager.getPatterns()

  return (
    <div className="bg-muted/50 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">URL Pattern Debugger</span>
        </div>
        <button
          onClick={() => setIsVisible(!isVisible)}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {isVisible && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Current URL Analysis</h4>
              <div className="bg-background rounded p-2 space-y-1">
                <div><strong>Domain:</strong> {debugInfo.domain}</div>
                <div><strong>Extracted Chapter:</strong> {debugInfo.extractedChapter || 'Not detected'}</div>
                <div><strong>Has Custom Pattern:</strong> {debugInfo.hasCustomPattern ? 'Yes' : 'No'}</div>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium">Test Chapter:</label>
                <input
                  type="number"
                  value={testChapter}
                  onChange={(e) => setTestChapter(parseInt(e.target.value) || 1)}
                  min="1"
                  className="w-16 px-2 py-1 text-xs bg-background border border-border rounded"
                />
              </div>
              
              <div>
                <strong>Generated URL:</strong>
                <div className="bg-background rounded p-2 mt-1 font-mono text-xs break-all">
                  {debugInfo.generatedUrl || 'Failed to generate'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium text-foreground">Available Patterns ({availablePatterns.length})</h4>
              <div className="bg-background rounded p-2 max-h-32 overflow-y-auto">
                {availablePatterns.length > 0 ? (
                  <div className="space-y-1">
                    {availablePatterns.map((pattern, index) => (
                      <div key={index} className="text-xs">
                        <div className="font-mono text-primary">{pattern.domain}</div>
                        <div className="text-muted-foreground ml-2">{pattern.pattern}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">No custom patterns configured</div>
                )}
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t border-border">
            <strong>How to add patterns:</strong> Add environment variables like 
            <code className="bg-background px-1 rounded">SITE_PATTERN_example_com=/chapter-{chapter}</code>
          </div>
        </div>
      )}
    </div>
  )
}

export default PatternDebugger