import { ChatMessage } from '@/types';
import { redis } from '../client';

export class ChatRepository {
  private static instance: ChatRepository;

  static getInstance(): ChatRepository {
    if (!ChatRepository.instance) {
      ChatRepository.instance = new ChatRepository();
    }
    return ChatRepository.instance;
  }

  async addChatMessage(roomId: string, message: ChatMessage): Promise<void> {
    const key = `chat:${roomId}`;
    await redis.lpush(key, JSON.stringify(message));
    await redis.ltrim(key, 0, 19); // Keep only last 20 messages
    await redis.expire(key, 86400); // 24 hours TTL
  }

  async getChatMessages(roomId: string, limit: number = 20): Promise<ChatMessage[]> {
    const messages = await redis.lrange(`chat:${roomId}`, 0, limit - 1);
    return messages
      .map(msg => {
        const parsed = JSON.parse(msg) as ChatMessage;
        parsed.timestamp = new Date(parsed.timestamp);
        return parsed;
      })
      .reverse(); // Reverse to get chronological order
  }
}
