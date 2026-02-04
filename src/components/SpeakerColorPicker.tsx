import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// 6 distinct speaker colors - HSL values for consistency with design system
export const SPEAKER_COLORS = [
  { id: 'purple', label: 'Purple', bg: 'bg-[hsl(262,83%,58%)]', text: 'text-white', hsl: 'hsl(262,83%,58%)' },
  { id: 'blue', label: 'Blue', bg: 'bg-[hsl(221,83%,53%)]', text: 'text-white', hsl: 'hsl(221,83%,53%)' },
  { id: 'green', label: 'Green', bg: 'bg-[hsl(142,71%,45%)]', text: 'text-white', hsl: 'hsl(142,71%,45%)' },
  { id: 'orange', label: 'Orange', bg: 'bg-[hsl(25,95%,53%)]', text: 'text-white', hsl: 'hsl(25,95%,53%)' },
  { id: 'pink', label: 'Pink', bg: 'bg-[hsl(330,81%,60%)]', text: 'text-white', hsl: 'hsl(330,81%,60%)' },
  { id: 'teal', label: 'Teal', bg: 'bg-[hsl(180,70%,45%)]', text: 'text-white', hsl: 'hsl(180,70%,45%)' },
] as const;

export type SpeakerColorId = typeof SPEAKER_COLORS[number]['id'];

export const getColorById = (colorId?: string) => {
  return SPEAKER_COLORS.find(c => c.id === colorId) || SPEAKER_COLORS[0];
};

// Get default color for a speaker based on index
export const getDefaultColorForSpeaker = (speakerId: string): SpeakerColorId => {
  const match = speakerId.match(/Speaker (\d+)/);
  if (match) {
    const index = (parseInt(match[1], 10) - 1) % SPEAKER_COLORS.length;
    return SPEAKER_COLORS[index].id;
  }
  return SPEAKER_COLORS[0].id;
};

interface SpeakerColorPickerProps {
  selectedColor: SpeakerColorId;
  onColorChange: (colorId: SpeakerColorId) => void;
}

export const SpeakerColorPicker: React.FC<SpeakerColorPickerProps> = ({
  selectedColor,
  onColorChange,
}) => {
  const currentColor = getColorById(selectedColor);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'w-6 h-6 rounded-full border-2 border-background shadow-sm shrink-0 cursor-pointer',
            'hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
            currentColor.bg
          )}
          title={`Color: ${currentColor.label}`}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="bg-popover z-50 min-w-[140px] p-2"
      >
        <div className="grid grid-cols-3 gap-2">
          {SPEAKER_COLORS.map((color) => (
            <DropdownMenuItem
              key={color.id}
              onClick={() => onColorChange(color.id)}
              className={cn(
                'w-8 h-8 rounded-full cursor-pointer p-0 flex items-center justify-center',
                color.bg,
                selectedColor === color.id && 'ring-2 ring-offset-2 ring-primary'
              )}
            >
              {selectedColor === color.id && (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
