-- Add speaker_colors column to store color assignments for each speaker
ALTER TABLE public.projects
ADD COLUMN speaker_colors jsonb DEFAULT '{}'::jsonb;