import React from 'react'
import { Filter, Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

interface ImageFilteringProps {
  imageFilters: string[]
  newFilter: string
  showImageFilters: boolean
  isLoading: boolean
  tooltipOpen: boolean
  onTooltipOpenChange: (open: boolean) => void
  onNewFilterChange: (value: string) => void
  onShowFiltersToggle: () => void
  onAddFilter: () => void
  onRemoveFilter: (filter: string) => void
  onClearAllFilters: () => void
}

const ImageFiltering: React.FC<ImageFilteringProps> = ({
  imageFilters,
  newFilter,
  showImageFilters,
  isLoading,
  tooltipOpen,
  onTooltipOpenChange,
  onNewFilterChange,
  onShowFiltersToggle,
  onAddFilter,
  onRemoveFilter,
  onClearAllFilters
}) => {
  return (
    <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <label className="text-sm font-medium text-foreground">Image Filtering</label>
          <Tooltip open={tooltipOpen} onOpenChange={onTooltipOpenChange}>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onTooltipOpenChange(!tooltipOpen)} 
                className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" 
                aria-label="Image filtering info"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <div className="text-xs max-w-64">
                <div className="font-medium mb-1">URL/Image Filtering</div>
                <div>Filter out unwanted images by adding text patterns. Images containing these patterns in their URLs will be excluded from results.</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center space-x-2">
          {imageFilters.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded">
              {imageFilters.length} filter{imageFilters.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={onShowFiltersToggle}
            className="px-3 py-1 text-xs bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 transition-colors"
          >
            {showImageFilters ? 'Hide' : 'Configure'}
          </button>
        </div>
      </div>
      
      {showImageFilters && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newFilter}
              onChange={(e) => onNewFilterChange(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && onAddFilter()}
              placeholder="Enter text to filter (e.g., 'logo', 'ad', 'banner')"
              className="flex-1 px-3 py-2 text-xs bg-input border border-border rounded-md text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />
            <button
              onClick={onAddFilter}
              disabled={isLoading || !newFilter.trim() || imageFilters.includes(newFilter.trim().toLowerCase())}
              className="px-3 py-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Filter
            </button>
          </div>
          
          {imageFilters.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Active Filters:</span>
                <button
                  onClick={onClearAllFilters}
                  className="text-xs text-destructive hover:text-destructive/80 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {imageFilters.map(filter => (
                  <span
                    key={filter}
                    className="inline-flex items-center space-x-1 px-2 py-1 bg-muted/60 text-foreground rounded text-xs"
                  >
                    <span>{filter}</span>
                    <button
                      onClick={() => onRemoveFilter(filter)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                      aria-label={`Remove filter: ${filter}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-xs text-muted-foreground">
            <div className="font-medium mb-1">Example filters:</div>
            <div>• "logo" - filters out company logos</div>
            <div>• "ad" or "banner" - removes advertisements</div>
            <div>• "watermark" - excludes watermarked images</div>
            <div>• "thumb" or "preview" - skips thumbnails</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ImageFiltering