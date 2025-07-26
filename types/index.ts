// Re-export everything from schemas for convenience
export * from './schemas';

// Import only the types needed for SocketEvents interface
import type {
  CreateRoomData,
  JoinRoomData,
  SetVideoData,
  VideoControlData,
  PromoteHostData,
  SendMessageData,
  SyncCheckData,
  RoomActionData,
  RoomCreatedResponse,
  RoomJoinedResponse,
  UserJoinedResponse,
  UserLeftResponse,
  UserPromotedResponse,
  VideoSetResponse,
  VideoEventResponse,
  SyncUpdateResponse,
  NewMessageResponse,
  TypingEventResponse,
  ErrorResponse,
  VideoState,
} from './schemas';

export interface SocketEvents {
  // Room events
  'create-room': (data: CreateRoomData) => void;
  'join-room': (data: JoinRoomData) => void;
  'leave-room': (data: RoomActionData) => void;
  'promote-host': (data: PromoteHostData) => void;
  'room-created': (data: RoomCreatedResponse) => void;
  'room-joined': (data: RoomJoinedResponse) => void;
  'room-error': (data: ErrorResponse) => void;
  'user-joined': (data: UserJoinedResponse) => void;
  'user-left': (data: UserLeftResponse) => void;
  'user-promoted': (data: UserPromotedResponse) => void;

  // Video events
  'set-video': (data: SetVideoData) => void;
  'video-set': (data: VideoSetResponse) => void;
  'play-video': (data: VideoControlData) => void;
  'pause-video': (data: VideoControlData) => void;
  'seek-video': (data: VideoControlData) => void;
  'sync-check': (data: SyncCheckData) => void;
  'video-played': (data: VideoEventResponse) => void;
  'video-paused': (data: VideoEventResponse) => void;
  'video-seeked': (data: VideoEventResponse) => void;
  'sync-update': (data: SyncUpdateResponse) => void;
  'sync-video': (data: { videoState: VideoState }) => void;

  // Chat events
  'send-message': (data: SendMessageData) => void;
  'message-sent': (data: NewMessageResponse) => void;
  'new-message': (data: NewMessageResponse) => void;
  'typing-start': (data: RoomActionData) => void;
  'typing-stop': (data: RoomActionData) => void;
  'user-typing': (data: TypingEventResponse) => void;
  'user-stopped-typing': (data: UserLeftResponse) => void;

  // General events
  error: (data: ErrorResponse) => void;
  disconnect: () => void;
}
