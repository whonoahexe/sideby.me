'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { SubtitleParser } from '@/lib/subtitle-utils';
import type { SubtitleTrack } from '@/types/schemas';

interface SubtitleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubtitleSelected: (tracks: SubtitleTrack[]) => void;
}

export function SubtitleUploadDialog({ open, onOpenChange, onSubtitleSelected }: SubtitleUploadDialogProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedTracks, setProcessedTracks] = useState<SubtitleTrack[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Get current scrollbar width
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      // Temporarily add padding to prevent layout shift
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    } else {
      // Remove padding when modal closes
      document.body.style.paddingRight = '';
    }

    return () => {
      // Cleanup on unmount
      document.body.style.paddingRight = '';
    };
  }, [open]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase();
      return ['vtt', 'srt', 'ass'].includes(extension || '');
    });

    if (validFiles.length !== files.length) {
      alert('Some files were skipped. Only .vtt, .srt, and .ass files are supported.');
    }

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    setProcessedTracks(prev => prev.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (uploadedFiles.length === 0) return;

    setIsProcessing(true);
    const tracks: SubtitleTrack[] = [];

    try {
      for (const file of uploadedFiles) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        console.log(`Processing ${extension?.toUpperCase()} subtitle file:`, file.name);

        let url: string;

        if (extension === 'vtt') {
          // VTT files can be used directly
          url = URL.createObjectURL(file);
        } else {
          // Parse and convert SRT/ASS files to VTT
          const cues = await SubtitleParser.parseSubtitleFile(file);
          console.log(`Parsed ${cues.length} subtitle cues`);

          // Convert to VTT format and create blob URL
          url = SubtitleParser.createBlobUrl(cues);
        }

        // Try to detect language from filename
        const filename = file.name.toLowerCase();
        let language = 'unknown';
        if (filename.includes('.en.') || filename.includes('english')) language = 'en';
        else if (filename.includes('.es.') || filename.includes('spanish')) language = 'es';
        else if (filename.includes('.fr.') || filename.includes('french')) language = 'fr';
        else if (filename.includes('.de.') || filename.includes('german')) language = 'de';
        else if (filename.includes('.it.') || filename.includes('italian')) language = 'it';
        else if (filename.includes('.pt.') || filename.includes('portuguese')) language = 'pt';
        else if (filename.includes('.ru.') || filename.includes('russian')) language = 'ru';
        else if (filename.includes('.zh.') || filename.includes('chinese')) language = 'zh';
        else if (filename.includes('.ja.') || filename.includes('japanese')) language = 'ja';
        else if (filename.includes('.ko.') || filename.includes('korean')) language = 'ko';

        const track: SubtitleTrack = {
          id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          label: file.name.replace(/\.[^/.]+$/, ''), // Remove extension from label
          language,
          url,
          format: 'vtt', // Always store as VTT since we convert
          isDefault: tracks.length === 0, // First track is default
        };

        tracks.push(track);
      }

      setProcessedTracks(tracks);
      console.log('Successfully processed subtitle files:', tracks);
    } catch (error) {
      console.error('Error processing subtitle files:', error);
      alert('Error processing some subtitle files. Please check the file formats and try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSubtitles = () => {
    if (processedTracks.length > 0) {
      onSubtitleSelected(processedTracks);

      // Give a small delay to allow the socket operation to complete
      // before closing the dialog and resetting state
      setTimeout(() => {
        onOpenChange(false);
        // Reset state
        setUploadedFiles([]);
        setProcessedTracks([]);
      }, 100);
    }
  };

  const getLanguageLabel = (code: string) => {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      zh: 'Chinese',
      ja: 'Japanese',
      ko: 'Korean',
      unknown: 'Unknown',
    };
    return languages[code] || code;
  };

  const getFileIcon = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    if (extension === 'vtt') return '🎬';
    if (extension === 'srt') return '📝';
    if (extension === 'ass') return '🎭';
    return '📄';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] flex max-h-[85vh] w-[95vw] max-w-2xl translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden p-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
        <DialogHeader className="px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Subtitle Files
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Subtitle Files</CardTitle>
              <CardDescription>
                Upload subtitle files in VTT, SRT, or ASS format. Multiple files are supported.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-lg font-medium">Click to select subtitle files</p>
                <p className="text-sm text-gray-500">or drag and drop files here</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Badge variant="outline">.vtt</Badge>
                  <Badge variant="outline">.srt</Badge>
                  <Badge variant="outline">.ass</Badge>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".vtt,.srt,.ass"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Selected Files */}
          {uploadedFiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Selected Files ({uploadedFiles.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <span className="text-2xl">{getFileIcon(file.name)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="ml-2 h-8 w-8 flex-shrink-0 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processed Tracks */}
          {processedTracks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Ready to Add ({processedTracks.length} tracks)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {processedTracks.map((track, _index) => (
                    <div
                      key={track.id}
                      className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium" title={track.label}>
                            {track.label}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {getLanguageLabel(track.language)}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {track.format.toUpperCase()}
                            </Badge>
                            {track.isDefault && <Badge className="bg-blue-500 text-xs">Default</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="flex justify-between border-t bg-gray-50 p-6 pt-4 dark:bg-black">
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            Cancel
          </Button>
          <div className="flex gap-2">
            {uploadedFiles.length > 0 && processedTracks.length === 0 && (
              <Button onClick={processFiles} disabled={isProcessing} size="sm">
                {isProcessing ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                    Processing...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Process Files
                  </>
                )}
              </Button>
            )}
            {processedTracks.length > 0 && (
              <Button onClick={handleAddSubtitles} size="sm">
                <CheckCircle className="mr-2 h-4 w-4" />
                Add Subtitles
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
