import React from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

interface ChapterInfo {
  hasChapter: boolean
  chapterNumber: number
  chapterSegment: string
}

interface ChapterNavigationProps {
  chapterInfo: ChapterInfo
  chapterCount: number
  tooltipOpen: boolean
  onTooltipOpenChange: (open: boolean) => void
}

const ChapterNavigation: React.FC<ChapterNavigationProps> = ({
  chapterInfo,
  chapterCount,
  tooltipOpen,
  onTooltipOpenChange
}) => {
  if (!chapterInfo.hasChapter) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center p-3 bg-accent/10 border border-accent/20 rounded-lg">
        <div className="flex items-center space-x-2 text-sm text-foreground">
          <div className="text-center">
            <span className="block">Chapter {chapterInfo.chapterNumber}</span>
            {chapterCount > 1 && (
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
                aria-label="Chapter info"
              >
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              Chapter {chapterInfo.chapterNumber} detected. Will fetch {chapterCount} chapter(s) when scraping starts.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export default ChapterNavigation