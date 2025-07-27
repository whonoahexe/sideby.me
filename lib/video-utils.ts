import { VideoType } from '@/types';

export function parseVideoUrl(url: string): { type: VideoType; embedUrl: string } | null {
  try {
    console.log('Parsing video URL:', url);
    const urlObj = new URL(url);

    // YouTube URLs
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId = '';

      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      } else if (urlObj.hostname.includes('youtube.com')) {
        videoId = urlObj.searchParams.get('v') || '';
      }

      if (videoId) {
        const result = {
          type: 'youtube' as VideoType,
          embedUrl: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`,
        };
        console.log('Parsed as YouTube:', result);
        return result;
      }
    }

    // Direct video URLs (MP4, WebM, etc.)
    if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
      const result = {
        type: 'mp4' as VideoType,
        embedUrl: url,
      };
      console.log('Parsed as MP4:', result);
      return result;
    }

    // M3U8 HLS streams
    if (url.match(/\.(m3u8)(\?.*)?$/i) || url.includes('/live/') || url.includes('.m3u8')) {
      const result = {
        type: 'm3u8' as VideoType,
        embedUrl: url,
      };
      console.log('Parsed as M3U8:', result);
      return result;
    }

    console.log('URL did not match any known video formats');
    return null;
  } catch (error) {
    console.error('Error parsing video URL:', error);
    return null;
  }
}

export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function calculateCurrentTime(videoState: {
  currentTime: number;
  isPlaying: boolean;
  lastUpdateTime: number;
}): number {
  if (!videoState.isPlaying) {
    return videoState.currentTime;
  }

  const timeDiff = (Date.now() - videoState.lastUpdateTime) / 1000;
  return videoState.currentTime + timeDiff;
}
