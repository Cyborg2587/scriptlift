import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MAX_RECORDING_SECONDS = 30 * 60; // 30 minutes

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ 
  onRecordingComplete, 
  disabled = false 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Auto-stop at max duration
  useEffect(() => {
    if (elapsedSeconds >= MAX_RECORDING_SECONDS && isRecording) {
      stopRecording();
    }
  }, [elapsedSeconds, isRecording, stopRecording]);

  const startRecording = async () => {
    try {
      setIsPreparing(true);
      chunksRef.current = [];
      setElapsedSeconds(0);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType;
        const ext = mimeType.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const file = new File([blob], `Recording_${timestamp}.${ext}`, { type: mimeType });
        onRecordingComplete(file);
        chunksRef.current = [];
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPreparing(false);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      setIsPreparing(false);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const remainingSeconds = MAX_RECORDING_SECONDS - elapsedSeconds;
  const remainingMinutes = Math.ceil(remainingSeconds / 60);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="lg"
        onClick={handleClick}
        disabled={disabled || isPreparing}
        className={cn(
          "w-full gap-2 transition-all",
          isRecording && "animate-pulse"
        )}
      >
        {isPreparing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Preparing...
          </>
        ) : isRecording ? (
          <>
            <Square className="w-5 h-5" />
            Stop Recording
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" />
            Start Recording
          </>
        )}
      </Button>
      
      {isRecording && (
        <div className="text-center space-y-1">
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-mono font-semibold text-foreground">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {remainingMinutes} min remaining
          </p>
        </div>
      )}
      
      {!isRecording && !isPreparing && (
        <p className="text-xs text-muted-foreground text-center">
          Record up to 30 minutes
        </p>
      )}
    </div>
  );
};
