export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface TranscriptionSegment {
  timestamp: number; // seconds
  text: string;
  speaker: string;
}

export interface TranscriptionResult {
  id: string;
  fileName: string;
  segments: TranscriptionSegment[];
  rawText: string;
  date: string;
}

export enum ProjectStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface Project {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  storage_path?: string;
  file_size?: number;
  status: ProjectStatus;
  transcription: TranscriptionResult | null;
  speaker_map: Record<string, string>;
  created_at: string;
  updated_at: string;
}
