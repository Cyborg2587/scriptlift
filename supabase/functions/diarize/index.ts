import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TranscriptionSegment {
  timestamp: number;
  text: string;
  speaker: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segments } = await req.json() as { segments: TranscriptionSegment[] };

    if (!segments || segments.length === 0) {
      return new Response(
        JSON.stringify({ segments: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Format transcript for analysis
    const transcriptText = segments
      .map((seg, i) => `[${i}] [${seg.timestamp.toFixed(1)}s] ${seg.text}`)
      .join("\n");

    const systemPrompt = `You are an expert at speaker diarization - identifying different speakers in a transcript.

Analyze this transcript and identify how many distinct speakers there are based on:
- Conversational patterns (questions vs answers, interruptions, topic changes)
- Speaking style differences (formal vs casual, verbose vs brief)
- Contextual clues (pronouns like "I", "you", references to different perspectives)
- Natural dialogue flow (back-and-forth exchanges)

IMPORTANT RULES:
1. Look for dialogue patterns - if someone asks a question and someone else answers, those are different speakers
2. If the content sounds like a conversation between 2+ people, identify them
3. Pay attention to changes in perspective, topic, or speaking style
4. Number speakers as "Speaker 1", "Speaker 2", etc.
5. Be consistent - the same speaker should keep the same label throughout

Return a JSON array where each element has:
- "index": the segment index number
- "speaker": the speaker label (e.g., "Speaker 1", "Speaker 2")

Example output format:
[{"index": 0, "speaker": "Speaker 1"}, {"index": 1, "speaker": "Speaker 2"}]`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { 
            role: "user", 
            content: `Analyze this transcript and identify the speakers for each segment:\n\n${transcriptText}\n\nReturn ONLY a JSON array with the speaker assignments. No explanation needed.`
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent results
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    // Parse the JSON response from the AI
    let speakerAssignments: Array<{ index: number; speaker: string }> = [];
    
    try {
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        speakerAssignments = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Fall back to original segments if parsing fails
      return new Response(
        JSON.stringify({ segments }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Apply speaker assignments to segments
    const diarizedSegments = segments.map((seg, i) => {
      const assignment = speakerAssignments.find(a => a.index === i);
      return {
        ...seg,
        speaker: assignment?.speaker || seg.speaker,
      };
    });

    return new Response(
      JSON.stringify({ segments: diarizedSegments }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Diarization error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
