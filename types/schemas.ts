import { z } from 'zod';

// Common validation patterns
export const UserNameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters long')
  .max(50, 'Name must be 50 characters or less')
  .regex(/^[a-zA-Z0-9\s\-_.!?]+$/, 'Name can only contain letters, numbers, spaces, and basic punctuation (- _ . ! ?)');

export const RoomIdSchema = z
  .string()
  .length(6, 'Room ID must be exactly 6 characters')
  .regex(/^[A-Z0-9]+$/, 'Room ID can only contain uppercase letters and numbers');

export const VideoUrlSchema = z.string().url('Invalid URL format').min(1, 'Video URL is required');

// Base schemas
export const VideoTypeSchema = z.enum(['youtube', 'mp4', 'm3u8']).nullable();

export const VideoStateSchema = z.object({
  isPlaying: z.boolean(),
  currentTime: z.number().min(0),
  duration: z.number().min(0),
  lastUpdateTime: z.number().positive(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: UserNameSchema,
  isHost: z.boolean(),
  joinedAt: z.date(),
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  userName: UserNameSchema,
  message: z.string().min(1, 'Message cannot be empty').max(1000, 'Message too long'),
  timestamp: z.date(),
  roomId: RoomIdSchema,
  isRead: z.boolean().default(false),
});

export const TypingUserSchema = z.object({
  userId: z.string().uuid(),
  userName: UserNameSchema,
  timestamp: z.number().positive(),
});

export const SubtitleTrackSchema = z.object({
  id: z.string(),
  label: z.string(),
  language: z.string(),
  url: z.string().url(),
  format: z.enum(['vtt', 'srt', 'ass']),
  isDefault: z.boolean().default(false),
});

export const RoomSchema = z.object({
  id: RoomIdSchema,
  hostId: z.string().uuid(),
  hostName: UserNameSchema,
  hostToken: z.string().uuid(),
  videoUrl: VideoUrlSchema.optional(),
  videoType: VideoTypeSchema,
  videoState: VideoStateSchema,
  users: z.array(UserSchema),
  createdAt: z.date(),
});

// Socket event schemas
export const CreateRoomDataSchema = z.object({
  hostName: UserNameSchema,
});

export const JoinRoomDataSchema = z.object({
  roomId: RoomIdSchema,
  userName: UserNameSchema,
  hostToken: z.string().uuid().optional(),
});

export const SetVideoDataSchema = z.object({
  roomId: RoomIdSchema,
  videoUrl: VideoUrlSchema,
});

export const VideoControlDataSchema = z.object({
  roomId: RoomIdSchema,
  currentTime: z.number().min(0),
});

export const PromoteHostDataSchema = z.object({
  roomId: RoomIdSchema,
  userId: z.string().uuid(),
});

export const SendMessageDataSchema = z.object({
  roomId: RoomIdSchema,
  message: z.string().min(1).max(1000),
});

export const SyncCheckDataSchema = z.object({
  roomId: RoomIdSchema,
  currentTime: z.number().min(0),
  isPlaying: z.boolean(),
  timestamp: z.number().positive(),
});

export const RoomActionDataSchema = z.object({
  roomId: RoomIdSchema,
});

// Response schemas
export const RoomCreatedResponseSchema = z.object({
  roomId: RoomIdSchema,
  room: RoomSchema,
  hostToken: z.string().uuid(),
});

export const RoomJoinedResponseSchema = z.object({
  room: RoomSchema,
  user: UserSchema,
});

export const UserJoinedResponseSchema = z.object({
  user: UserSchema,
});

export const UserLeftResponseSchema = z.object({
  userId: z.string().uuid(),
});

export const UserPromotedResponseSchema = z.object({
  userId: z.string().uuid(),
  userName: UserNameSchema,
});

export const VideoSetResponseSchema = z.object({
  videoUrl: VideoUrlSchema,
  videoType: z.enum(['youtube', 'mp4', 'm3u8']),
});

export const VideoEventResponseSchema = z.object({
  currentTime: z.number().min(0),
  timestamp: z.number().positive(),
});

export const SyncUpdateResponseSchema = z.object({
  currentTime: z.number().min(0),
  isPlaying: z.boolean(),
  timestamp: z.number().positive(),
});

export const NewMessageResponseSchema = z.object({
  message: ChatMessageSchema,
});

export const TypingEventResponseSchema = z.object({
  userId: z.string().uuid(),
  userName: UserNameSchema,
});

export const ErrorResponseSchema = z.object({
  error: z.string().min(1),
});

// Type inference from schemas
export type User = z.infer<typeof UserSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type TypingUser = z.infer<typeof TypingUserSchema>;
export type VideoState = z.infer<typeof VideoStateSchema>;
export type VideoType = z.infer<typeof VideoTypeSchema>;
export type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>;

// Socket event data types
export type CreateRoomData = z.infer<typeof CreateRoomDataSchema>;
export type JoinRoomData = z.infer<typeof JoinRoomDataSchema>;
export type SetVideoData = z.infer<typeof SetVideoDataSchema>;
export type VideoControlData = z.infer<typeof VideoControlDataSchema>;
export type PromoteHostData = z.infer<typeof PromoteHostDataSchema>;
export type SendMessageData = z.infer<typeof SendMessageDataSchema>;
export type SyncCheckData = z.infer<typeof SyncCheckDataSchema>;
export type RoomActionData = z.infer<typeof RoomActionDataSchema>;

// Response types
export type RoomCreatedResponse = z.infer<typeof RoomCreatedResponseSchema>;
export type RoomJoinedResponse = z.infer<typeof RoomJoinedResponseSchema>;
export type UserJoinedResponse = z.infer<typeof UserJoinedResponseSchema>;
export type UserLeftResponse = z.infer<typeof UserLeftResponseSchema>;
export type UserPromotedResponse = z.infer<typeof UserPromotedResponseSchema>;
export type VideoSetResponse = z.infer<typeof VideoSetResponseSchema>;
export type VideoEventResponse = z.infer<typeof VideoEventResponseSchema>;
export type SyncUpdateResponse = z.infer<typeof SyncUpdateResponseSchema>;
export type NewMessageResponse = z.infer<typeof NewMessageResponseSchema>;
export type TypingEventResponse = z.infer<typeof TypingEventResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
