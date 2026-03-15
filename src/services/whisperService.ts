import { TranscriptionSegment } from "@/types";
import { diarizeSegments } from "./diarizationService";

const TARGET_SAMPLE_RATE = 16000;

const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (err) => {
        clearTimeout(timeoutId);
        reject(err);
      }
    );
  });
};

// Web Worker code for Whisper transcription - using ES module worker
const WORKER_CODE = `
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

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
  // Use module worker for ES module imports
  const newWorker = new Worker(workerUrl, { type: 'module' });
  // Safe to revoke after worker is created
  URL.revokeObjectURL(workerUrl);
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
      console.error('Whisper Worker error:', e);
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

const downmixToMono = (buffer: AudioBuffer): Float32Array => {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);

  const length = buffer.length;
  const out = new Float32Array(length);

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] += data[i];
  }
  for (let i = 0; i < length; i++) out[i] /= buffer.numberOfChannels;
  return out;
};

// Fast JS downsampler (avoids OfflineAudioContext hanging on long files)
const downsampleBuffer = (
  input: Float32Array,
  inputSampleRate: number,
  outputSampleRate: number
): Float32Array => {
  if (inputSampleRate === outputSampleRate) return input;
  if (inputSampleRate < outputSampleRate) {
    // Upsampling is rare for typical media; keep behavior explicit.
    throw new Error('Unsupported audio sample rate. Please convert to MP3/WAV and try again.');
  }

  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);

  let outputOffset = 0;
  let inputOffset = 0;

  while (outputOffset < outputLength) {
    const nextInputOffset = Math.round((outputOffset + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (let i = inputOffset; i < nextInputOffset && i < input.length; i++) {
      sum += input[i];
      count++;
    }
    output[outputOffset] = count ? sum / count : input[inputOffset] ?? 0;
    outputOffset++;
    inputOffset = nextInputOffset;
  }

  return output;
};

// Decode and resample audio to 16kHz (required by Whisper)
const getAudioData = async (file: File, onProgress: (status: string) => void): Promise<Float32Array> => {
  try {
    onProgress("Reading audio file...");
    const arrayBuffer = await file.arrayBuffer();
    
    onProgress("Decoding audio...");
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const decoded = await withTimeout<AudioBuffer>(
      audioCtx.decodeAudioData(arrayBuffer) as Promise<AudioBuffer>,
      5 * 60 * 1000,
      'Audio decoding timed out. Please try a smaller file or convert to MP3/WAV.'
    );

    onProgress("Preparing audio...");
    const mono = downmixToMono(decoded);

    onProgress("Downsampling to 16kHz...");
    const downsampled = downsampleBuffer(mono, decoded.sampleRate, TARGET_SAMPLE_RATE);

    // Close audio context to free resources
    await audioCtx.close();

    return downsampled;
  } catch (err: any) {
    console.error("Audio decoding failed:", err);
    throw new Error(
      err?.message ||
        "Could not decode this audio in your browser. If it's long, try splitting it into smaller parts (10–20 minutes) or converting to MP3/WAV."
    );
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
    const audioSeconds = audioData.length / TARGET_SAMPLE_RATE;
    
    // Run transcription
    const rawSegments = await new Promise<TranscriptionSegment[]>((resolve, reject) => {
      // Dynamic timeout: keep long-form audio from being killed prematurely,
      // while still preventing infinite hangs.
      const timeoutMs = Math.min(
        6 * 60 * 60 * 1000,
        Math.max(30 * 60 * 1000, Math.round(audioSeconds * 20 * 1000))
      );
      const timeout = setTimeout(() => {
        reject(new Error('Transcription timed out. The file may be too long for in-browser processing.'));
      }, timeoutMs);
      
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
              speaker: "Speaker 1" // Placeholder - will be updated by diarization
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

    // Perform speaker diarization using AI
    const diarizedSegments = await diarizeSegments(rawSegments, onProgress);
    
    return diarizedSegments;
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
