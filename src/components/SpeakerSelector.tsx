import React from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getColorById, SpeakerColorId } from './SpeakerColorPicker';

interface SpeakerSelectorProps {
  currentSpeaker: string;
  speakers: string[];
  speakerMap: Record<string, string>;
  speakerColors: Record<string, SpeakerColorId>;
  onSpeakerChange: (newSpeaker: string) => void;
}

export const SpeakerSelector: React.FC<SpeakerSelectorProps> = ({
  currentSpeaker,
  speakers,
  speakerMap,
  speakerColors,
  onSpeakerChange,
}) => {
  const currentColor = getColorById(speakerColors[currentSpeaker]);
  const displayName = speakerMap[currentSpeaker] || currentSpeaker;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span
          className={cn(
            'inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer',
            'hover:opacity-80 transition-opacity group',
            currentColor.bg,
            currentColor.text
          )}
          title="Click to change speaker"
        >
          <span className="truncate max-w-[60px]">{displayName}</span>
          <ChevronDown className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-popover z-50 min-w-[160px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium border-b border-border mb-1">
          Assign to speaker
        </div>
        {speakers.map((speakerId) => {
          const color = getColorById(speakerColors[speakerId]);
          const name = speakerMap[speakerId] || speakerId;
          const isSelected = speakerId === currentSpeaker;

          return (
            <DropdownMenuItem
              key={speakerId}
              onClick={() => onSpeakerChange(speakerId)}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isSelected && 'bg-muted'
              )}
            >
              <span
                className={cn(
                  'w-3 h-3 rounded-full shrink-0',
                  color.bg
                )}
              />
              <span className="flex-grow truncate">{name}</span>
              {isSelected && (
                <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
