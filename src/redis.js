const { createClient } = require('redis');

class RedisManager {
  constructor() {
    this.pubClient = null;
    this.subClient = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.pubClient = createClient({ 
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis 서버에 연결할 수 없습니다.');
            return new Error('Redis 서버 연결 실패');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Redis 재연결 시간 초과');
          }
          if (options.attempt > 10) {
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.subClient = this.pubClient.duplicate();

      // 이벤트 리스너 설정
      this.pubClient.on('error', (err) => {
        console.error('Redis Publisher 에러:', err);
        this.isConnected = false;
      });

      this.pubClient.on('connect', () => {
        console.log('✅ Redis Publisher 연결됨');
      });

      this.pubClient.on('ready', () => {
        console.log('✅ Redis Publisher 준비됨');
        this.isConnected = true;
      });

      this.subClient.on('error', (err) => {
        console.error('Redis Subscriber 에러:', err);
      });

      this.subClient.on('connect', () => {
        console.log('✅ Redis Subscriber 연결됨');
      });

      // 연결
      await this.pubClient.connect();
      await this.subClient.connect();

      return { pubClient: this.pubClient, subClient: this.subClient };
    } catch (error) {
      console.error('❌ Redis 연결 실패:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.pubClient) {
        await this.pubClient.quit();
        console.log('✅ Redis Publisher 연결 종료');
      }
      if (this.subClient) {
        await this.subClient.quit();
        console.log('✅ Redis Subscriber 연결 종료');
      }
      this.isConnected = false;
    } catch (error) {
      console.error('❌ Redis 연결 종료 중 오류:', error);
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      hasPubClient: !!this.pubClient,
      hasSubClient: !!this.subClient
    };
  }

  // Redis 캐시 유틸리티 메서드들
  async set(key, value, ttl = 3600) {
    if (!this.isConnected || !this.pubClient) {
      throw new Error('Redis가 연결되지 않았습니다.');
    }
    return await this.pubClient.set(key, JSON.stringify(value), 'EX', ttl);
  }

  async get(key) {
    if (!this.isConnected || !this.pubClient) {
      throw new Error('Redis가 연결되지 않았습니다.');
    }
    const value = await this.pubClient.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key) {
    if (!this.isConnected || !this.pubClient) {
      throw new Error('Redis가 연결되지 않았습니다.');
    }
    return await this.pubClient.del(key);
  }

  async exists(key) {
    if (!this.isConnected || !this.pubClient) {
      throw new Error('Redis가 연결되지 않았습니다.');
    }
    return await this.pubClient.exists(key);
  }
}

module.exports = new RedisManager(); 