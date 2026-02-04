import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface ProjectNameEditorProps {
  name: string;
  onSave: (newName: string) => void;
  className?: string;
}

export const ProjectNameEditor: React.FC<ProjectNameEditorProps> = ({
  name,
  onSave,
  className
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(name);
  }, [name]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== name) {
      onSave(trimmed);
    } else {
      setEditValue(name);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="h-6 text-xs py-0 px-1"
        />
        <button
          onClick={handleSave}
          className="p-0.5 hover:bg-muted rounded text-primary"
          type="button"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={handleCancel}
          className="p-0.5 hover:bg-muted rounded text-muted-foreground"
          type="button"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-1 group", className)}>
      <span className="truncate">{name}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-opacity"
        title="Rename project"
        type="button"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
};
