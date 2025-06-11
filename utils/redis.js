const Redis = require('ioredis');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        retryTimes: 3,
        maxRetriesPerRequest: 3,
        lazyConnect: true
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected successfully');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', error);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      await this.client.connect();
      
    } catch (error) {
      logger.error('Redis initialization failed:', error);
      throw error;
    }
  }

  async ping() {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed:', error);
      return false;
    }
  }

  // Cache sentiment analysis results
  async cacheSentimentResult(key, data, ttlSeconds = 3600) {
    try {
      await this.client.setex(`sentiment:${key}`, ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Error caching sentiment result:', error);
      return false;
    }
  }

  async getCachedSentimentResult(key) {
    try {
      const result = await this.client.get(`sentiment:${key}`);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Error retrieving cached sentiment result:', error);
      return null;
    }
  }

  // API rate limiting
  async checkRateLimit(apiKey, windowSeconds = 60, maxRequests = 100) {
    try {
      const key = `rate_limit:${apiKey}`;
      const current = await this.client.incr(key);
      
      if (current === 1) {
        await this.client.expire(key, windowSeconds);
      }
      
      return {
        allowed: current <= maxRequests,
        current: current,
        remaining: Math.max(0, maxRequests - current),
        resetTime: Date.now() + (windowSeconds * 1000)
      };
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return { allowed: true, current: 0, remaining: maxRequests };
    }
  }

  // Usage tracking for billing
  async trackAPIUsage(apiKey, endpoint, dataPoints = 1) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `usage:${apiKey}:${today}`;
      const endpointKey = `usage:${apiKey}:${endpoint}:${today}`;
      
      await Promise.all([
        this.client.hincrby(usageKey, 'total_requests', 1),
        this.client.hincrby(usageKey, 'total_data_points', dataPoints),
        this.client.hincrby(endpointKey, 'requests', 1),
        this.client.hincrby(endpointKey, 'data_points', dataPoints),
        this.client.expire(usageKey, 86400 * 31), // Keep for 31 days
        this.client.expire(endpointKey, 86400 * 31)
      ]);
      
      return true;
    } catch (error) {
      logger.error('Error tracking API usage:', error);
      return false;
    }
  }

  async getAPIUsage(apiKey, days = 30) {
    try {
      const usage = [];
      const today = new Date();
      
      for (let i = 0; i < days; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const usageKey = `usage:${apiKey}:${dateStr}`;
        const dayUsage = await this.client.hgetall(usageKey);
        
        usage.push({
          date: dateStr,
          requests: parseInt(dayUsage.total_requests || 0),
          dataPoints: parseInt(dayUsage.total_data_points || 0)
        });
      }
      
      return usage;
    } catch (error) {
      logger.error('Error retrieving API usage:', error);
      return [];
    }
  }

  // ML model caching
  async cacheMLResult(modelId, inputHash, result, ttlSeconds = 7200) {
    try {
      const key = `ml:${modelId}:${inputHash}`;
      await this.client.setex(key, ttlSeconds, JSON.stringify(result));
      return true;
    } catch (error) {
      logger.error('Error caching ML result:', error);
      return false;
    }
  }

  async getCachedMLResult(modelId, inputHash) {
    try {
      const key = `ml:${modelId}:${inputHash}`;
      const result = await this.client.get(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      logger.error('Error retrieving cached ML result:', error);
      return null;
    }
  }

  // Research dataset access tracking
  async trackDatasetAccess(datasetId, clientId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const accessKey = `dataset_access:${datasetId}:${today}`;
      const clientKey = `client_dataset_access:${clientId}:${today}`;
      
      await Promise.all([
        this.client.incr(accessKey),
        this.client.sadd(clientKey, datasetId),
        this.client.expire(accessKey, 86400 * 365), // Keep for 1 year
        this.client.expire(clientKey, 86400 * 365)
      ]);
      
      return true;
    } catch (error) {
      logger.error('Error tracking dataset access:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Redis disconnected');
    }
  }
}

module.exports = new RedisClient();