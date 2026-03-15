import { supabase } from "@/integrations/supabase/client";
import { TranscriptionSegment } from "@/types";

/**
 * Performs speaker diarization on transcription segments using AI analysis.
 * Identifies different speakers based on conversational patterns, speaking styles,
 * and contextual clues in the transcript.
 */
export const diarizeSegments = async (
  segments: TranscriptionSegment[],
  onProgress?: (status: string) => void
): Promise<TranscriptionSegment[]> => {
  if (!segments || segments.length === 0) {
    return segments;
  }

  onProgress?.("Analyzing speakers...");

  try {
    // For very short transcripts (1-2 segments), skip diarization
    if (segments.length <= 2) {
      onProgress?.("Transcript too short for speaker analysis");
      return segments;
    }

    // Batch segments for large transcripts to avoid token limits
    const MAX_SEGMENTS_PER_BATCH = 100;
    const batches: TranscriptionSegment[][] = [];
    
    for (let i = 0; i < segments.length; i += MAX_SEGMENTS_PER_BATCH) {
      batches.push(segments.slice(i, i + MAX_SEGMENTS_PER_BATCH));
    }

    let allDiarizedSegments: TranscriptionSegment[] = [];
    let speakerOffset = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      if (batches.length > 1) {
        onProgress?.(`Analyzing speakers (batch ${batchIndex + 1}/${batches.length})...`);
      }

      const { data, error } = await supabase.functions.invoke("diarize", {
        body: { segments: batch },
      });

      if (error) {
        console.error("Diarization error:", error);
        // On error, keep original segments with default speaker
        allDiarizedSegments = [...allDiarizedSegments, ...batch];
        continue;
      }

      if (data?.segments) {
        // Adjust speaker numbers for subsequent batches to maintain continuity
        const batchSegments = data.segments.map((seg: TranscriptionSegment) => {
          if (batchIndex > 0 && seg.speaker) {
            // Extract speaker number and add offset for continuity
            const match = seg.speaker.match(/Speaker (\\d+)/);
            if (match) {
              const num = parseInt(match[1], 10);
              return { ...seg, speaker: `Speaker ${num + speakerOffset}` };
            }
          }
          return seg;
        });

        // Track the highest speaker number in this batch for the offset
        const speakersInBatch = new Set(
          batchSegments.map((s: TranscriptionSegment) => s.speaker)
        );
        speakerOffset = speakersInBatch.size;

        allDiarizedSegments = [...allDiarizedSegments, ...batchSegments];
      } else {
        allDiarizedSegments = [...allDiarizedSegments, ...batch];
      }
    }

    // Count unique speakers for the progress message
    const uniqueSpeakers = new Set(allDiarizedSegments.map(s => s.speaker));
    onProgress?.(`Identified ${uniqueSpeakers.size} speaker${uniqueSpeakers.size !== 1 ? 's' : ''}`);

    return allDiarizedSegments;
  } catch (error) {
    console.error("Diarization failed:", error);
    onProgress?.("Speaker analysis unavailable, using default speaker");
    return segments;
  }
};

