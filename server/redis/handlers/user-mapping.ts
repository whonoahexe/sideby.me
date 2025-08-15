import { redis } from '../client';

export class UserMappingRepository {
  private static instance: UserMappingRepository;

  static getInstance(): UserMappingRepository {
    if (!UserMappingRepository.instance) {
      UserMappingRepository.instance = new UserMappingRepository();
    }
    return UserMappingRepository.instance;
  }

  // TTL is set to 2 hours to handle edge cases where disconnect cleanup might fail
  async setUserSocket(userId: string, socketId: string): Promise<void> {
    await redis.setex(`user_socket:${userId}`, 7200, socketId); // 2 hours TTL
  }

  // Get the socketId for a given userId
  // Returns null if no mapping exists or mapping has expired
  async getUserSocket(userId: string): Promise<string | null> {
    return await redis.get(`user_socket:${userId}`);
  }

  // Remove the userId -> socketId mapping
  // Called when a user disconnects
  async removeUserSocket(userId: string): Promise<void> {
    await redis.del(`user_socket:${userId}`);
  }

  // Check if a userId has an active socket mapping
  async hasUserSocket(userId: string): Promise<boolean> {
    const exists = await redis.exists(`user_socket:${userId}`);
    return exists === 1;
  }

  // Get all active user -> socket mappings (for debugging/monitoring)
  async getAllUserSockets(): Promise<Record<string, string>> {
    const mappings: Record<string, string> = {};
    let cursor = '0';

    do {
      const result = await redis.scan(cursor, 'MATCH', 'user_socket:*', 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        const values = await redis.mget(...keys);
        keys.forEach((key, index) => {
          const userId = key.replace('user_socket:', '');
          const socketId = values[index];
          if (socketId) {
            mappings[userId] = socketId;
          }
        });
      }
    } while (cursor !== '0');

    return mappings;
  }
}
