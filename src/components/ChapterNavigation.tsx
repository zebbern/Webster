import React from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

interface ChapterInfo {
  hasChapter: boolean
  chapterNumber: number
  chapterSegment: string
}

interface NavigationState {
  canGoPrev: boolean
  canGoNext: boolean
}

interface ChapterNavigationProps {
  url: string
  chapterInfo: ChapterInfo
  navState: NavigationState
  chapterCount: number
  targetChapterRange: { start: number; end: number } | null
  isLoading: boolean
  tooltipOpen: boolean
  onTooltipOpenChange: (open: boolean) => void
  onNavigate: (direction: 'prev' | 'next') => void
}

const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  chapterInfo,
  navState,
  chapterCount,
  targetChapterRange,
  isLoading,
  tooltipOpen,
  onTooltipOpenChange,
  onNavigate
}) => {
  if (!chapterInfo.hasChapter) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center space-x-3 p-3 bg-accent/10 border border-accent/20 rounded-lg">
        <button
          onClick={() => onNavigate('prev')}
          disabled={!navState.canGoPrev || isLoading || chapterInfo.chapterNumber <= chapterCount}
          className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
            navState.canGoPrev && !isLoading && chapterInfo.chapterNumber > chapterCount
              ? 'bg-card border-border hover:bg-accent text-foreground'
              : 'bg-muted border-muted text-muted-foreground cursor-not-allowed'
          }`}
          title={`Previous ${chapterCount} chapter(s)`}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-2 text-sm text-foreground">
          <div className="text-center">
            <span className="block">Chapter {chapterInfo.chapterNumber}</span>
            {targetChapterRange && (
              <span className="text-xs text-muted-foreground">
                Loading {targetChapterRange.start}-{targetChapterRange.end}
              </span>
            )}
            {!targetChapterRange && chapterCount > 1 && (
              <span className="text-xs text-muted-foreground">
                Will load {chapterCount} chapters
              </span>
            )}
          </div>
          <Tooltip open={tooltipOpen} onOpenChange={onTooltipOpenChange}>
            <TooltipTrigger asChild>
              <button 
                onClick={() => onTooltipOpenChange(!tooltipOpen)} 
                className="w-5 h-5 rounded-full bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground" 
                aria-label="Navigation info"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Use the chapter navigation buttons to jump by {chapterCount} chapter(s). The URL will update to the final chapter position.
            </TooltipContent>
          </Tooltip>
        </div>

        <button
          onClick={() => onNavigate('next')}
          disabled={!navState.canGoNext || isLoading}
          className={`p-2 rounded-lg border transition-colors flex items-center justify-center ${
            navState.canGoNext && !isLoading
              ? 'bg-card border-border hover:bg-accent text-foreground'
              : 'bg-muted border-muted text-muted-foreground cursor-not-allowed'
          }`}
          title={`Next ${chapterCount} chapter(s)`}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export default ChapterNavigation