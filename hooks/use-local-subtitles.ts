'use client';

import { useState, useCallback, useEffect } from 'react';
import type { SubtitleTrack } from '@/types/schemas';

interface UseLocalSubtitlesOptions {
  roomId: string;
  videoId?: string;
}

interface UseLocalSubtitlesReturn {
  subtitleTracks: SubtitleTrack[];
  activeTrackId?: string;
  // Actions
  addSubtitleTracks: (newTracks: SubtitleTrack[]) => void;
  removeSubtitleTrack: (trackId: string) => void;
  setActiveSubtitleTrack: (trackId?: string) => void;
  clearAllSubtitleTracks: () => void;
}

/**
 * Hook for managing subtitles locally without socket synchronization.
 * Subtitles are stored per room/video combination in localStorage.
 */
export function useLocalSubtitles({ roomId, videoId }: UseLocalSubtitlesOptions): UseLocalSubtitlesReturn {
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | undefined>();

  // Create a unique storage key for this room/video combination
  const storageKey = `subtitles_${roomId}${videoId ? `_${videoId}` : ''}`;
  const activeTrackKey = `subtitle_active_${roomId}${videoId ? `_${videoId}` : ''}`;

  // Load subtitles from localStorage on mount and when key changes
  useEffect(() => {
    try {
      const storedTracks = localStorage.getItem(storageKey);
      const storedActiveTrack = localStorage.getItem(activeTrackKey);

      if (storedTracks) {
        const tracks = JSON.parse(storedTracks) as SubtitleTrack[];
        setSubtitleTracks(tracks);
      } else {
        setSubtitleTracks([]);
      }

      if (storedActiveTrack && storedActiveTrack !== 'undefined') {
        setActiveTrackId(storedActiveTrack);
      } else {
        setActiveTrackId(undefined);
      }
    } catch (error) {
      console.error('Failed to load subtitles from localStorage:', error);
      setSubtitleTracks([]);
      setActiveTrackId(undefined);
    }
  }, [storageKey, activeTrackKey]);

  // Save subtitles to localStorage whenever they change
  const saveToStorage = useCallback(
    (tracks: SubtitleTrack[], activeId?: string) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(tracks));
        if (activeId !== undefined) {
          localStorage.setItem(activeTrackKey, activeId || '');
        }
      } catch (error) {
        console.error('Failed to save subtitles to localStorage:', error);
      }
    },
    [storageKey, activeTrackKey]
  );

  // Add new subtitle tracks
  const addSubtitleTracks = useCallback(
    (newTracks: SubtitleTrack[]) => {
      setSubtitleTracks(prev => {
        const updatedTracks = [...prev, ...newTracks];

        // Auto-select the first new track if no track is currently active
        let newActiveTrackId = activeTrackId;
        if (!activeTrackId && newTracks.length > 0) {
          newActiveTrackId = newTracks[0].id;
          setActiveTrackId(newActiveTrackId);
        }

        saveToStorage(updatedTracks, newActiveTrackId);
        return updatedTracks;
      });
    },
    [activeTrackId, saveToStorage]
  );

  // Remove a subtitle track
  const removeSubtitleTrack = useCallback(
    (trackId: string) => {
      setSubtitleTracks(prev => {
        const updatedTracks = prev.filter(track => track.id !== trackId);

        // If we removed the active track, clear the active track
        let newActiveTrackId = activeTrackId;
        if (activeTrackId === trackId) {
          newActiveTrackId = undefined;
          setActiveTrackId(undefined);
        }

        saveToStorage(updatedTracks, newActiveTrackId);
        return updatedTracks;
      });
    },
    [activeTrackId, saveToStorage]
  );

  // Set the active subtitle track
  const setActiveSubtitleTrackInternal = useCallback(
    (trackId?: string) => {
      setActiveTrackId(trackId);
      saveToStorage(subtitleTracks, trackId);
    },
    [subtitleTracks, saveToStorage]
  );

  // Clear all subtitle tracks
  const clearAllSubtitleTracks = useCallback(() => {
    setSubtitleTracks([]);
    setActiveTrackId(undefined);
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(activeTrackKey);
    } catch (error) {
      console.error('Failed to clear subtitles from localStorage:', error);
    }
  }, [storageKey, activeTrackKey]);

  return {
    subtitleTracks,
    activeTrackId,
    addSubtitleTracks,
    removeSubtitleTrack,
    setActiveSubtitleTrack: setActiveSubtitleTrackInternal,
    clearAllSubtitleTracks,
  };
}
