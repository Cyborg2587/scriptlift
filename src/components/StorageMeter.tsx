import React from 'react';
import { HardDrive, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface StorageMeterProps {
  usedBytes: number;
  limitBytes: number;
  className?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const StorageMeter: React.FC<StorageMeterProps> = ({
  usedBytes,
  limitBytes,
  className,
}) => {
  const percentage = Math.min((usedBytes / limitBytes) * 100, 100);
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {isCritical ? (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          ) : (
            <HardDrive className="w-4 h-4" />
          )}
          <span>Storage</span>
        </div>
        <span
          className={cn(
            'font-medium',
            isCritical && 'text-destructive',
            isWarning && !isCritical && 'text-warning'
          )}
        >
          {formatBytes(usedBytes)} / {formatBytes(limitBytes)}
        </span>
      </div>
      <Progress
        value={percentage}
        className={cn(
          'h-2',
          isCritical && '[&>div]:bg-destructive',
          isWarning && !isCritical && '[&>div]:bg-warning'
        )}
      />
      {isCritical && (
        <p className="text-xs text-destructive">
          Storage almost full. Delete files to upload more.
        </p>
      )}
    </div>
  );
};
