import { TranscriptionSegment } from "@/types";

// Web Worker code for Whisper transcription - using classic worker syntax with importScripts
const WORKER_CODE = `
importScripts('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');

// Access the library from global scope (classic workers)
const { pipeline, env } = self.Transformers || {};

if (!pipeline) {
  self.postMessage({ status: 'error', error: 'Failed to load Transformers library' });
}

env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber = null;
let isLoading = false;

self.addEventListener('message', async (event) => {
  const { type, audio } = event.data;

  if (type === 'load') {
    if (isLoading) return;
    isLoading = true;
    
    try {
      if (!transcriber) {
        self.postMessage({ status: 'progress', message: 'Loading AI Model...' });
        
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en', {
          progress_callback: (data) => {
            if (data.status === 'progress') {
              const percent = Math.round(data.progress || 0);
              self.postMessage({ 
                status: 'progress', 
                message: 'Loading Model: ' + percent + '%' 
              });
            } else if (data.status === 'initiate') {
              self.postMessage({ status: 'progress', message: 'Initializing AI Engine...' });
            } else if (data.status === 'done') {
              self.postMessage({ status: 'progress', message: 'Model loaded!' });
            }
          }
        });
      }
      self.postMessage({ status: 'ready' });
    } catch (err) {
      self.postMessage({ status: 'error', error: err.message || 'Failed to load model' });
    } finally {
      isLoading = false;
    }
    return;
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      self.postMessage({ status: 'error', error: 'Model not loaded yet. Please wait.' });
      return;
    }

    try {
      self.postMessage({ status: 'progress', message: 'Transcribing audio...' });
      
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: true,
        language: 'english',
        no_repeat_ngram_size: 2,
        repetition_penalty: 1.2,
      });

      self.postMessage({ status: 'complete', output });
    } catch (err) {
      self.postMessage({ status: 'error', error: err.message || 'Transcription failed' });
    }
  }
});

// Signal that the worker is alive
self.postMessage({ status: 'alive' });
`;

let worker: Worker | null = null;
let workerReadyPromise: Promise<void> | null = null;
let workerReady = false;

const createWorker = (): Worker => {
  const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
  const workerUrl = URL.createObjectURL(blob);
  // Use classic worker (not module) for importScripts compatibility
  const newWorker = new Worker(workerUrl);
  return newWorker;
};

const resetWorker = () => {
  if (worker) {
    worker.terminate();
  }
  worker = null;
  workerReadyPromise = null;
  workerReady = false;
};

const getOrCreateWorker = (): Worker => {
  if (!worker) {
    worker = createWorker();
    
    // Add global error handler
    worker.onerror = (e) => {
      console.error('Whisper Worker error:', e.message);
      resetWorker();
    };
  }
  return worker;
};

const initializeWorker = (onProgress: (status: string) => void): Promise<void> => {
  if (workerReady && workerReadyPromise) {
    return workerReadyPromise;
  }
  
  const currentWorker = getOrCreateWorker();
  
  workerReadyPromise = new Promise((resolve, reject) => {
    // Timeout after 5 minutes (model download can take a while)
    const timeout = setTimeout(() => {
      resetWorker();
      reject(new Error('Model loading timed out. Please refresh and try again.'));
    }, 5 * 60 * 1000);
    
    const handler = (e: MessageEvent) => {
      const { status, message, error } = e.data;
      
      if (status === 'alive') {
        // Worker is running, send load command
        currentWorker.postMessage({ type: 'load' });
      } else if (status === 'ready') {
        clearTimeout(timeout);
        currentWorker.removeEventListener('message', handler);
        workerReady = true;
        resolve();
      } else if (status === 'progress') {
        onProgress(message);
      } else if (status === 'error') {
        clearTimeout(timeout);
        currentWorker.removeEventListener('message', handler);
        resetWorker();
        reject(new Error(error));
      }
    };
    
    currentWorker.addEventListener('message', handler);
  });
  
  return workerReadyPromise;
};

// Decode and resample audio to 16000Hz (required by Whisper)
const getAudioData = async (file: File, onProgress: (status: string) => void): Promise<Float32Array> => {
  try {
    onProgress("Reading audio file...");
    const arrayBuffer = await file.arrayBuffer();
    
    onProgress("Decoding audio...");
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const decoded = await audioCtx.decodeAudioData(arrayBuffer);
    
    onProgress("Resampling to 16kHz...");
    const offlineCtx = new OfflineAudioContext(1, decoded.duration * 16000, 16000);
    const source = offlineCtx.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineCtx.destination);
    source.start();
    
    const resampled = await offlineCtx.startRendering();
    
    // Close audio context to free resources
    await audioCtx.close();
    
    return resampled.getChannelData(0);
  } catch (err: any) {
    console.error("Audio decoding failed:", err);
    throw new Error("Could not decode audio file. It might be corrupt or an unsupported format. Try converting to MP3 or WAV.");
  }
};

export const transcribeWithWhisper = async (
  file: File,
  onProgress: (status: string) => void
): Promise<TranscriptionSegment[]> => {
  try {
    // Initialize worker (downloads model if needed)
    await initializeWorker(onProgress);
    
    const currentWorker = getOrCreateWorker();
    
    // Process audio
    const audioData = await getAudioData(file, onProgress);
    
    // Run transcription
    return new Promise((resolve, reject) => {
      // Timeout for transcription (30 minutes for very long files)
      const timeout = setTimeout(() => {
        reject(new Error('Transcription timed out. The file may be too long.'));
      }, 30 * 60 * 1000);
      
      const handler = (e: MessageEvent) => {
        const { status, message, output, error } = e.data;
        
        if (status === 'progress') {
          onProgress(message);
        } else if (status === 'complete') {
          clearTimeout(timeout);
          currentWorker.removeEventListener('message', handler);
          
          // Handle case where output might not have chunks
          const chunks = output?.chunks || [];
          
          if (chunks.length === 0) {
            // Fallback: if no chunks, use the full text
            const segments: TranscriptionSegment[] = [{
              timestamp: 0,
              text: output?.text?.trim() || 'No transcription available',
              speaker: "Speaker 1"
            }];
            resolve(segments);
          } else {
            const segments: TranscriptionSegment[] = chunks.map((chunk: any) => ({
              timestamp: Array.isArray(chunk.timestamp) ? chunk.timestamp[0] : chunk.timestamp || 0,
              text: (chunk.text || '').trim(),
              speaker: "Speaker 1"
            }));
            resolve(segments);
          }
        } else if (status === 'error') {
          clearTimeout(timeout);
          currentWorker.removeEventListener('message', handler);
          reject(new Error(error));
        }
      };
      
      currentWorker.addEventListener('message', handler);
      
      // Transfer the audio buffer to the worker (more efficient)
      currentWorker.postMessage({ type: 'transcribe', audio: audioData }, [audioData.buffer]);
    });
  } catch (error: any) {
    // Reset worker on any error so next attempt starts fresh
    resetWorker();
    throw error;
  }
};

// Optional: Preload the model when the app starts
export const preloadWhisperModel = (onProgress?: (status: string) => void) => {
  initializeWorker(onProgress || (() => {})).catch(console.error);
};
