import { supabase } from "@/integrations/supabase/client";
import { Project, ProjectStatus, TranscriptionResult } from "@/types";

// Transform database row to Project type
const transformProject = (row: any): Project => ({
  id: row.id,
  user_id: row.user_id,
  file_name: row.file_name,
  file_type: row.file_type,
  storage_path: row.storage_path,
  file_size: row.file_size,
  status: row.status as ProjectStatus,
  transcription: row.transcription as TranscriptionResult | null,
  speaker_map: (row.speaker_map as Record<string, string>) || {},
  speaker_colors: (row.speaker_colors as Record<string, string>) || {},
  created_at: row.created_at,
  updated_at: row.updated_at,
});

// Upload file to storage
export const uploadFileToStorage = async (file: File, userId: string): Promise<string> => {
  const fileId = crypto.randomUUID();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  const filePath = `${userId}/${fileId}_${sanitizedName}`;
  
  const { error } = await supabase.storage
    .from('media-files')
    .upload(filePath, file, { upsert: false });

  if (error) throw error;
  return filePath;
};

// Get signed URL for file
export const getFileUrl = async (storagePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('media-files')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error getting file URL:', error);
    return null;
  }
  return data.signedUrl;
};

// Download file from storage
export const downloadFile = async (storagePath: string): Promise<Blob | null> => {
  const { data, error } = await supabase.storage
    .from('media-files')
    .download(storagePath);

  if (error) {
    console.error('Error downloading file:', error);
    return null;
  }
  return data;
};

// Create a new project
export const createProject = async (
  userId: string,
  fileName: string,
  fileType: string,
  storagePath: string,
  fileSize: number
): Promise<Project> => {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      file_name: fileName,
      file_type: fileType,
      storage_path: storagePath,
      file_size: fileSize,
      status: 'QUEUED',
      speaker_map: {},
    })
    .select()
    .single();

  if (error) throw error;
  return transformProject(data);
};

// Get all projects for a user
export const getProjects = async (userId: string): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(transformProject);
};

// Update a project
export const updateProject = async (
  projectId: string,
  updates: {
    status?: string;
    transcription?: TranscriptionResult | null;
    speaker_map?: Record<string, string>;
    speaker_colors?: Record<string, string>;
  }
): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update(updates as any)
    .eq('id', projectId);

  if (error) throw error;
};

// Rename a project
export const renameProject = async (
  projectId: string,
  newName: string
): Promise<void> => {
  const { error } = await supabase
    .from('projects')
    .update({ file_name: newName })
    .eq('id', projectId);

  if (error) throw error;
};

// Delete a project
export const deleteProject = async (project: Project): Promise<void> => {
  // Delete file from storage if exists
  if (project.storage_path) {
    await supabase.storage
      .from('media-files')
      .remove([project.storage_path]);
  }

  // Delete project record
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', project.id);

  if (error) throw error;
};
