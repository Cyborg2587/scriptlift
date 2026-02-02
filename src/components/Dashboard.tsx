import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Project, ProjectStatus, TranscriptionResult } from '@/types';
import { 
  UploadCloud, Clock, FileText, FileVideo, Download, Loader2, 
  Users, Mic, PlayCircle, Trash2, CheckCircle, AlertCircle, Cloud, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StorageMeter } from '@/components/StorageMeter';
import { downloadPdf, downloadTxt, downloadDoc } from '@/services/exportService';
import { transcribeWithWhisper } from '@/services/whisperService';
import { cn } from '@/lib/utils';
import { 
  createProject, 
  getProjects, 
  updateProject, 
  deleteProject as deleteProjectService,
  uploadFileToStorage, 
  downloadFile 
} from '@/services/projectService';

const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1GB
const STUCK_PROCESSING_AFTER_MS = 30 * 60 * 1000; // 30 minutes

interface DashboardProps {
  user: User;
}

type VideoSize = 'small' | 'medium' | 'large';

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [showSpeakers, setShowSpeakers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [projectErrors, setProjectErrors] = useState<Record<string, string>>({});
  const [videoSize, setVideoSize] = useState<VideoSize>('large');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLMediaElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId), 
    [projects, selectedProjectId]
  );

  const uniqueSpeakers = useMemo(() => {
    if (!selectedProject?.transcription) return [];
    const speakers = new Set<string>();
    selectedProject.transcription.segments.forEach(seg => speakers.add(seg.speaker));
    return Array.from(speakers).sort(); 
  }, [selectedProject]);

  // Load projects on mount and reset stuck PROCESSING projects
  useEffect(() => {
    const initialize = async () => {
      await loadProjects();
    };
    initialize();
  }, [user.id]);

  // Reset any stuck PROCESSING projects to QUEUED on page load
  useEffect(() => {
    const resetStuckProjects = async () => {
      const stuckProjects = projects.filter((p) => {
        if (p.status !== ProjectStatus.PROCESSING) return false;
        const updatedAt = new Date(p.updated_at).getTime();
        return Number.isFinite(updatedAt) && Date.now() - updatedAt > STUCK_PROCESSING_AFTER_MS;
      });
      for (const project of stuckProjects) {
        await updateProject(project.id, { status: ProjectStatus.QUEUED });
        setProjects(prev => prev.map(p => 
          p.id === project.id ? { ...p, status: ProjectStatus.QUEUED } : p
        ));
      }
    };
    if (!loading && projects.length > 0) {
      resetStuckProjects();
    }
  }, [loading]); // Only run once after initial load

  // Queue processing
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessingQueue) return;
      const nextProject = projects.find(p => p.status === ProjectStatus.QUEUED);
      if (!nextProject) return;
      setIsProcessingQueue(true);
      await processProject(nextProject);
      setIsProcessingQueue(false);
    };
    processQueue();
  }, [projects, isProcessingQueue]);

  // Load media URL when project changes
  useEffect(() => {
    let active = true;
    const loadMedia = async () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      setMediaUrl(null);
      if (selectedProject?.storage_path) {
        try {
          const blob = await downloadFile(selectedProject.storage_path);
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          if (active) setMediaUrl(url);
        } catch (e) {
          console.error('Failed to load media:', e);
        }
      }
    };
    loadMedia();
    return () => { active = false; };
  }, [selectedProjectId, selectedProject?.storage_path]);

  const usedStorageBytes = useMemo(() => {
    return projects.reduce((sum, p) => sum + (p.file_size || 0), 0);
  }, [projects]);

  const getUniqueDisplayName = (name: string, usedNames: Set<string>) => {
    if (!usedNames.has(name)) return name;

    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';

    let n = 2;
    let candidate = `${base} (${n})${ext}`;
    while (usedNames.has(candidate)) {
      n++;
      candidate = `${base} (${n})${ext}`;
    }
    return candidate;
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await getProjects(user.id);
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleIncomingFiles(event.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleIncomingFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    let runningUsedBytes = usedStorageBytes;
    const usedNames = new Set(projects.map((p) => p.file_name));

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        if (runningUsedBytes + file.size > STORAGE_LIMIT_BYTES) {
          alert(
            `Upload blocked: your account is limited to 1GB of total storage.\n\nPlease delete some files before uploading more.`
          );
          continue;
        }

        const displayName = getUniqueDisplayName(file.name, usedNames);
        usedNames.add(displayName);

        setProgressText(`Uploading ${displayName}...`);
        const storagePath = await uploadFileToStorage(file, user.id);
        const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
        const fileType = file.type || (isVideo ? 'video/mp4' : 'audio/mp3');
        
        const newProject = await createProject(user.id, displayName, fileType, storagePath, file.size);
        setProjects(prev => [newProject, ...prev]);
        runningUsedBytes += file.size;
        
        if (!selectedProjectId) {
          setSelectedProjectId(newProject.id);
        }
      } catch (error: any) {
        console.error('Upload failed:', error);
        alert(`Failed to upload ${file.name}: ${error.message}`);
      }
    }
    setProgressText('');
  };

  const processProject = async (project: Project) => {
    try {
      setProjectErrors((prev) => {
        const { [project.id]: _removed, ...rest } = prev;
        return rest;
      });

      // Update status to processing
      await updateProject(project.id, { status: ProjectStatus.PROCESSING });
      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, status: ProjectStatus.PROCESSING } : p
      ));

      // Download file
      setProgressText(`Downloading ${project.file_name}...`);
      const blob = await downloadFile(project.storage_path!);
      if (!blob) throw new Error('Could not download file');
      const file = new File([blob], project.file_name, { type: project.file_type });

      // Transcribe
      setProgressText(`Transcribing ${project.file_name}...`);
      const segments = await transcribeWithWhisper(file, setProgressText);

      const result: TranscriptionResult = {
        id: project.id,
        fileName: project.file_name,
        segments,
        rawText: segments.map(s => s.text).join(' '),
        date: new Date().toISOString(),
      };

      // Update project
      await updateProject(project.id, { 
        status: ProjectStatus.COMPLETED, 
        transcription: result 
      });
      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, status: ProjectStatus.COMPLETED, transcription: result } : p
      ));
    } catch (error: any) {
      console.error(`Error processing ${project.file_name}:`, error);
      await updateProject(project.id, { status: ProjectStatus.ERROR });
      setProjectErrors((prev) => ({
        ...prev,
        [project.id]: error?.message || 'Processing failed',
      }));
      setProjects(prev => prev.map(p => 
        p.id === project.id ? { ...p, status: ProjectStatus.ERROR } : p
      ));
    } finally {
      setProgressText('');
    }
  };

  const handleRetryProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectErrors((prev) => {
      const { [project.id]: _removed, ...rest } = prev;
      return rest;
    });
    // Reset to QUEUED so it gets picked up by the queue processor
    await updateProject(project.id, { status: ProjectStatus.QUEUED });
    setProjects(prev => prev.map(p => 
      p.id === project.id ? { ...p, status: ProjectStatus.QUEUED } : p
    ));
  };

  const handleDeleteProject = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await deleteProjectService(project);
      setProjects(prev => prev.filter(p => p.id !== project.id));
      if (selectedProjectId === project.id) {
        setSelectedProjectId(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleExport = (type: 'pdf' | 'txt' | 'doc') => {
    if (!selectedProject?.transcription) return;
    if (type === 'pdf') {
      downloadPdf(selectedProject.transcription, showTimestamps, showSpeakers, selectedProject.speaker_map);
    } else if (type === 'doc') {
      downloadDoc(selectedProject.transcription, showTimestamps, showSpeakers, selectedProject.speaker_map);
    } else {
      downloadTxt(selectedProject.transcription, showTimestamps, showSpeakers, selectedProject.speaker_map);
    }
  };

  const updateSpeakerName = async (speakerId: string, newName: string) => {
    if (!selectedProject) return;
    const updatedMap = { ...selectedProject.speaker_map, [speakerId]: newName };
    setProjects(prev => prev.map(p => 
      p.id === selectedProject.id ? { ...p, speaker_map: updatedMap } : p
    ));
    await updateProject(selectedProject.id, { speaker_map: updatedMap });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const jumpToTime = (seconds: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play();
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleIncomingFiles(e.dataTransfer.files);
  };

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate video preview dimensions based on size
  const getVideoPreviewSize = () => {
    switch (videoSize) {
      case 'small':
        return 'w-40 h-24 sm:w-48 sm:h-28';
      case 'medium':
        return 'w-64 h-40 sm:w-80 sm:h-48';
      case 'large':
      default:
        return 'w-80 h-48 sm:w-96 sm:h-56 md:w-[480px] md:h-72';
    }
  };

  const isVideoFile = selectedProject?.file_type.startsWith('video/');

  return (
    <div
      className={cn(
        'flex-grow flex flex-col',
        selectedProject && mediaUrl ? 'pb-28' : 'pb-0'
      )}
    >
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Your Transcriptions</h1>
            <p className="text-muted-foreground text-sm flex items-center gap-1">
              <Cloud className="w-4 h-4" />
              Files synced to cloud
            </p>
          </div>
          
          {selectedProject?.status === ProjectStatus.COMPLETED && (
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleExport('txt')}>
                <FileText className="w-4 h-4 mr-1" /> TXT
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('doc')}>
                <FileText className="w-4 h-4 mr-1" /> Word
              </Button>
              <Button size="sm" onClick={() => handleExport('pdf')}>
                <Download className="w-4 h-4 mr-1" /> PDF
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
          {/* Left Column */}
          <div className="lg:col-span-4 space-y-6">
            {/* Upload Zone */}
            <Card
              className={`border-2 border-dashed cursor-pointer transition-all ${
                isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <CardContent className="py-8 text-center">
                <input 
                  type="file" 
                  multiple 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  accept="audio/*,video/*" 
                  className="hidden" 
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-3 rounded-full ${isProcessingQueue ? 'bg-warning/10' : 'bg-primary/10'}`}>
                    {isProcessingQueue ? (
                      <Loader2 className="w-6 h-6 text-warning animate-spin" />
                    ) : (
                      <UploadCloud className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {isDragging ? 'Drop files here' : 'Upload Files'}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {progressText || 'Drag & Drop or click to upload audio/video'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Storage Meter */}
            <StorageMeter
              usedBytes={usedStorageBytes}
              limitBytes={STORAGE_LIMIT_BYTES}
            />

            {/* Project List */}
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/50 py-3">
                <CardTitle className="text-sm font-semibold flex justify-between">
                  <span>Your Projects</span>
                  <span className="text-muted-foreground font-normal">{projects.length} Files</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                {projects.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No projects yet. Upload a file to get started.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {projects.map((p) => (
                      <div 
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`p-4 cursor-pointer transition-colors flex items-center justify-between group ${
                          selectedProjectId === p.id 
                            ? 'bg-primary/5 border-l-4 border-primary' 
                            : 'hover:bg-muted/50 border-l-4 border-transparent'
                        }`}
                      >
                        <div className="min-w-0 flex-grow pr-4">
                          <h4 className={`text-sm font-medium truncate ${
                            selectedProjectId === p.id ? 'text-primary' : 'text-foreground'
                          }`}>
                            {p.file_name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            {p.status === ProjectStatus.QUEUED && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Queued
                              </span>
                            )}
                            {p.status === ProjectStatus.PROCESSING && (
                              <span className="text-xs bg-warning/10 text-warning px-1.5 py-0.5 rounded flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" /> Processing
                              </span>
                            )}
                            {p.status === ProjectStatus.COMPLETED && (
                              <span className="text-xs bg-success/10 text-success px-1.5 py-0.5 rounded flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Ready
                              </span>
                            )}
                            {p.status === ProjectStatus.ERROR && (
                              <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Failed
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {p.status === ProjectStatus.ERROR && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => handleRetryProject(e, p)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
                              title="Retry transcription"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDeleteProject(e, p)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Settings */}
            {selectedProject?.transcription && (
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Display Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Show Timestamps
                    </Label>
                    <Switch checked={showTimestamps} onCheckedChange={setShowTimestamps} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      Show Speakers
                    </Label>
                    <Switch checked={showSpeakers} onCheckedChange={setShowSpeakers} />
                  </div>
                  
                  {showSpeakers && uniqueSpeakers.length > 0 && (
                    <div className="pt-4 border-t border-border space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Identify Speakers
                      </Label>
                      {uniqueSpeakers.map((speakerId) => (
                        <div key={speakerId} className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Mic className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="flex-grow">
                            <Label className="text-xs text-muted-foreground">{speakerId}</Label>
                            <Input 
                              type="text" 
                              placeholder="Enter Name..." 
                              value={selectedProject.speaker_map[speakerId] || ''} 
                              onChange={(e) => updateSpeakerName(speakerId, e.target.value)} 
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Transcript Viewer */}
          <div className="lg:col-span-8">
            <Card className="h-[600px] flex flex-col overflow-hidden">
              <CardHeader className="bg-muted/50 py-3 shrink-0">
                <CardTitle className="text-sm flex justify-between items-center">
                  <span>
                    {selectedProject ? `Transcription: ${selectedProject.file_name}` : 'Transcription Output'}
                  </span>
                  {selectedProject?.transcription && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                      {selectedProject.transcription.segments.length} segments
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="flex-grow overflow-y-auto p-4">
                <div className="space-y-3" ref={transcriptContainerRef}>
                {!selectedProject && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="w-16 h-16 mb-4 opacity-20" />
                    <p>Select a project to view the transcript</p>
                  </div>
                )}

                {selectedProject?.status === ProjectStatus.QUEUED && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Clock className="w-12 h-12 mb-4 text-primary/30" />
                    <p className="font-medium">File Queued</p>
                    <p className="text-sm">Waiting for processor...</p>
                  </div>
                )}

                {selectedProject?.status === ProjectStatus.PROCESSING && (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-12 h-12 mb-4 text-warning animate-spin" />
                    <p className="font-medium">Processing File</p>
                    <p className="text-sm">{progressText || 'This may take a moment...'}</p>
                  </div>
                )}

                {selectedProject?.status === ProjectStatus.ERROR && (
                  <div className="h-full flex flex-col items-center justify-center text-destructive">
                    <AlertCircle className="w-12 h-12 mb-4" />
                    <p className="font-medium">Processing Failed</p>
                    <p className="text-sm text-center max-w-md">
                      {projectErrors[selectedProject.id] || 'Please try uploading again.'}
                    </p>
                  </div>
                )}

                {selectedProject?.transcription?.segments.map((segment, index) => {
                  const displayName = selectedProject.speaker_map[segment.speaker] || segment.speaker;
                  const nextSeg = selectedProject.transcription!.segments[index + 1];
                  const effectiveEnd = nextSeg ? nextSeg.timestamp : segment.timestamp + 5;
                  const isActive = currentTime >= segment.timestamp && currentTime < effectiveEnd;
                  
                  return (
                    <div 
                      key={index} 
                      onClick={() => jumpToTime(segment.timestamp)}
                      className={`flex gap-3 p-3 rounded-lg transition-all cursor-pointer border-l-4 ${
                        isActive 
                          ? 'bg-primary/5 border-primary shadow-sm' 
                          : 'hover:bg-muted/50 border-transparent'
                      }`}
                    >
                      <div className="flex flex-col gap-1 items-start min-w-[80px] shrink-0 pt-1">
                        {showTimestamps && (
                          <div className={`flex items-center gap-1 ${
                            isActive ? 'text-primary font-bold' : 'text-muted-foreground'
                          }`}>
                            {isActive && <PlayCircle className="w-3 h-3 animate-pulse" />}
                            <span className="text-xs font-mono font-medium">
                              {formatTime(segment.timestamp)}
                            </span>
                          </div>
                        )}
                        {showSpeakers && (
                          <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                            {displayName}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm leading-relaxed ${
                        isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                      }`}>
                        {segment.text}
                      </p>
                    </div>
                  );
                })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Floating Video Preview - positioned above the bottom bar */}
      {selectedProject && mediaUrl && isVideoFile && (
        <div className={cn(
          "fixed z-40 bg-card border border-border rounded-lg shadow-xl overflow-hidden transition-all duration-200",
          "bottom-28 right-4 sm:right-6",
          getVideoPreviewSize()
        )}>
          {/* Size toggle buttons */}
          <div className="absolute top-2 left-2 z-10 flex gap-1 bg-background/80 backdrop-blur-sm rounded-md p-1">
            <button
              onClick={() => setVideoSize('small')}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors",
                videoSize === 'small' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              S
            </button>
            <button
              onClick={() => setVideoSize('medium')}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors",
                videoSize === 'medium' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              M
            </button>
            <button
              onClick={() => setVideoSize('large')}
              className={cn(
                "px-2 py-0.5 text-xs rounded transition-colors",
                videoSize === 'large' 
                  ? "bg-primary text-primary-foreground" 
                  : "hover:bg-muted text-muted-foreground"
              )}
            >
              L
            </button>
          </div>
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={mediaUrl}
            playsInline
            preload="metadata"
            className="w-full h-full object-contain bg-black"
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          />
        </div>
      )}

      {/* Fixed Bottom Player - consistent height for both audio and video */}
      {selectedProject && mediaUrl && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              {/* File info */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {isVideoFile 
                    ? <FileVideo className="w-5 h-5 text-primary" /> 
                    : <FileText className="w-5 h-5 text-primary" />
                  }
                </div>
                <div className="min-w-0 max-w-[120px] sm:max-w-[200px]">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedProject.file_name}
                  </p>
                  <button 
                    onClick={() => setSelectedProjectId(null)} 
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Close Player
                  </button>
                </div>
              </div>

              {/* Audio player - inline in bar */}
              {!isVideoFile && (
                <div className="flex-1">
                  <audio
                    ref={mediaRef as React.RefObject<HTMLAudioElement>}
                    src={mediaUrl}
                    controls
                    className="w-full"
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  />
                </div>
              )}

              {/* Video controls - separate since video is floating */}
              {isVideoFile && (
                <div className="flex-1 flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (mediaRef.current) {
                        if (mediaRef.current.paused) {
                          mediaRef.current.play();
                        } else {
                          mediaRef.current.pause();
                        }
                      }
                    }}
                    className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  >
                    <PlayCircle className="w-5 h-5 text-primary" />
                  </button>
                  <div className="flex-1">
                    <input
                      type="range"
                      min="0"
                      max={mediaRef.current?.duration || 100}
                      value={currentTime}
                      onChange={(e) => {
                        const time = parseFloat(e.target.value);
                        if (mediaRef.current) {
                          mediaRef.current.currentTime = time;
                        }
                        setCurrentTime(time);
                      }}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono min-w-[45px]">
                    {formatTime(currentTime)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
