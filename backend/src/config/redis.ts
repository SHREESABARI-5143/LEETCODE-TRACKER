import Redis from 'ioredis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      return null; // Stop retrying if redis is not running locally
    }
    return Math.min(times * 1000, 3000);
  },
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

let loggedRedisWarning = false;
redis.on('error', (err) => {
  if (!loggedRedisWarning) {
    logger.warn('Redis offline — using in-memory cache');
    loggedRedisWarning = true;
  }
});

