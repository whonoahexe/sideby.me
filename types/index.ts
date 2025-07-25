export interface User {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: Date;
}

export interface Room {
  id: string;
  hostId: string;
  hostName: string;
  hostToken: string;
  videoUrl?: string;
  videoType: 'youtube' | 'mp4' | null;
  videoState: VideoState;
  users: User[];
  createdAt: Date;
}

export interface CreateRoomData {
  hostName: string;
}

export interface JoinRoomData {
  roomId: string;
  userName: string;
}

export type VideoType = 'youtube' | 'mp4' | null;

export interface VideoState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lastUpdateTime: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: Date;
  roomId: string;
}

export interface SocketEvents {
  // Room events
  'create-room': (data: { hostName: string }) => void;
  'join-room': (data: { roomId: string; userName: string; hostToken?: string }) => void;
  'leave-room': (data: { roomId: string }) => void;
  'room-created': (data: { roomId: string; room: Room; hostToken: string }) => void;
  'room-joined': (data: { room: Room; user: User }) => void;
  'room-error': (data: { error: string }) => void;
  'user-joined': (data: { user: User }) => void;
  'user-left': (data: { userId: string }) => void;

  // Video events
  'set-video': (data: { roomId: string; videoUrl: string }) => void;
  'video-set': (data: { videoUrl: string; videoType: 'youtube' | 'mp4' }) => void;
  'play-video': (data: { roomId: string; currentTime: number }) => void;
  'pause-video': (data: { roomId: string; currentTime: number }) => void;
  'seek-video': (data: { roomId: string; currentTime: number }) => void;
  'video-played': (data: { currentTime: number; timestamp: number }) => void;
  'video-paused': (data: { currentTime: number; timestamp: number }) => void;
  'video-seeked': (data: { currentTime: number; timestamp: number }) => void;
  'sync-video': (data: { videoState: VideoState }) => void;

  // Chat events
  'send-message': (data: { roomId: string; message: string }) => void;
  'message-sent': (data: { message: ChatMessage }) => void;
  'new-message': (data: { message: ChatMessage }) => void;

  // General events
  error: (data: { error: string }) => void;
  disconnect: () => void;
}
