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
  KickUserData,
  RoomCreatedResponse,
  RoomJoinedResponse,
  UserJoinedResponse,
  UserLeftResponse,
  UserPromotedResponse,
  UserKickedResponse,
  VideoSetResponse,
  VideoEventResponse,
  SyncUpdateResponse,
  NewMessageResponse,
  TypingEventResponse,
  ErrorResponse,
  VideoState,
  VoiceJoinData,
  VoiceLeaveData,
  VoicePeerJoinResponse,
  VoiceOffer,
  VoiceAnswer,
  VoiceIceCandidate,
  VoicePeerLeaveResponse,
  VoiceErrorResponse,
  VoiceExistingPeersResponse,
  VoiceOfferEventResponse,
  VoiceAnswerEventResponse,
  VoiceIceCandidateEventResponse,
  VoiceParticipantCountResponse,
  ReactionUpdatedResponse,
} from './schemas';

export interface SocketEvents {
  // Room events
  'create-room': (data: CreateRoomData) => void;
  'join-room': (data: JoinRoomData) => void;
  'leave-room': (data: RoomActionData) => void;
  'kick-user': (data: KickUserData) => void;
  'promote-host': (data: PromoteHostData) => void;
  'room-created': (data: RoomCreatedResponse) => void;
  'room-joined': (data: RoomJoinedResponse) => void;
  'room-error': (data: ErrorResponse) => void;
  'user-joined': (data: UserJoinedResponse) => void;
  'user-left': (data: UserLeftResponse) => void;
  'user-promoted': (data: UserPromotedResponse) => void;
  'user-kicked': (data: UserKickedResponse) => void;

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
  'video-error-report': (data: {
    roomId: string;
    code?: number;
    message?: string;
    currentSrc: string;
    currentTime?: number;
  }) => void;

  // Chat events
  'send-message': (data: SendMessageData) => void;
  'message-sent': (data: NewMessageResponse) => void;
  'new-message': (data: NewMessageResponse) => void;
  'toggle-reaction': (data: { roomId: string; messageId: string; emoji: string }) => void;
  'reaction-updated': (data: ReactionUpdatedResponse) => void;
  'typing-start': (data: RoomActionData) => void;
  'typing-stop': (data: RoomActionData) => void;
  'user-typing': (data: TypingEventResponse) => void;
  'user-stopped-typing': (data: UserLeftResponse) => void;

  // General events
  error: (data: ErrorResponse) => void;
  disconnect: () => void;

  // Voice chat signaling
  // Client -> Server
  'voice-join': (data: VoiceJoinData) => void;
  'voice-leave': (data: VoiceLeaveData) => void;
  'voice-offer': (data: VoiceOffer) => void;
  'voice-answer': (data: VoiceAnswer) => void;
  'voice-ice-candidate': (data: VoiceIceCandidate) => void;
  // Server -> Client
  'voice-peer-joined': (data: VoicePeerJoinResponse) => void;
  'voice-existing-peers': (data: VoiceExistingPeersResponse) => void;
  'voice-offer-received': (data: VoiceOfferEventResponse) => void;
  'voice-answer-received': (data: VoiceAnswerEventResponse) => void;
  'voice-ice-candidate-received': (data: VoiceIceCandidateEventResponse) => void;
  'voice-peer-left': (data: VoicePeerLeaveResponse) => void;
  'voice-error': (data: VoiceErrorResponse) => void;
  'voice-participant-count': (data: VoiceParticipantCountResponse) => void;
}
