'use client';
import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { RemoteVideoStream } from '@/hooks/use-video-chat';

interface VideoChatGridProps {
  localStream: MediaStream | null;
  remoteStreams: RemoteVideoStream[];
  currentUserId: string;
  isCameraOff: boolean;
  className?: string;
}

export const VideoChatGrid: React.FC<VideoChatGridProps> = ({
  localStream,
  remoteStreams,
  currentUserId,
  isCameraOff,
  className,
}) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className={cn('grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4', className)}>
      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-muted">
        {localStream && !isCameraOff ? (
          <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full scale-x-[-1] object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">Camera Off</span>
        )}
        <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">You</div>
      </div>
      {remoteStreams.map(r => (
        <VideoTile key={r.userId} stream={r.stream} userId={r.userId} />
      ))}
    </div>
  );
};

const VideoTile: React.FC<{ stream: MediaStream; userId: string }> = ({ stream, userId }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current && stream && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative aspect-video overflow-hidden rounded bg-muted">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-cover" />
      <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
        {userId.slice(0, 6)}
      </div>
    </div>
  );
};
