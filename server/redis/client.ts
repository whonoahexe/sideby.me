import Redis from 'ioredis';

// Redis client setup with Upstash support
const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  console.log('Initializing Redis connection...');

  // For Upstash Redis, we need to configure TLS properly
  if (redisUrl.includes('upstash.io')) {
    console.log('Detected Upstash Redis, configuring TLS...');
    const url = new URL(redisUrl);
    return new Redis({
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || 'default',
      password: url.password,
      tls: {
        rejectUnauthorized: false,
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });
  }

  // For local Redis
  console.log('Using local Redis configuration...');
  return new Redis(redisUrl, {
    lazyConnect: true,
    keepAlive: 30000,
  });
};

const redis = createRedisClient();

// Add error handling for connection issues
redis.on('error', error => {
  console.error('Redis connection error:', error);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('ready', () => {
  console.log('Redis ready for commands');
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('Redis reconnecting...');
});

export { redis };
