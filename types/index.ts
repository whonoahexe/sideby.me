// Export Zod-inferred types from schemas
export type {
  User,
  Room,
  ChatMessage,
  TypingUser,
  VideoState,
  VideoType,
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
} from '@/lib/schemas';

// Export schemas for validation
export {
  UserSchema,
  RoomSchema,
  ChatMessageSchema,
  TypingUserSchema,
  VideoStateSchema,
  VideoTypeSchema,
  UserNameSchema,
  RoomIdSchema,
  VideoUrlSchema,
  CreateRoomDataSchema,
  JoinRoomDataSchema,
  SetVideoDataSchema,
  VideoControlDataSchema,
  PromoteHostDataSchema,
  SendMessageDataSchema,
  SyncCheckDataSchema,
  RoomActionDataSchema,
  RoomCreatedResponseSchema,
  RoomJoinedResponseSchema,
  UserJoinedResponseSchema,
  UserLeftResponseSchema,
  UserPromotedResponseSchema,
  VideoSetResponseSchema,
  VideoEventResponseSchema,
  SyncUpdateResponseSchema,
  NewMessageResponseSchema,
  TypingEventResponseSchema,
  ErrorResponseSchema,
} from '@/lib/schemas';

// Import types for use in SocketEvents
import type {
  User,
  Room,
  ChatMessage,
  VideoState,
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
} from '@/lib/schemas';

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
