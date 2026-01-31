import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';

let connection: IORedis | undefined;

function initializeRedisConnection(): IORedis | undefined {
  try {
    const redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    });

    redis.on('error', (error) => {
      console.warn('Redis connection error:', error.message);
    });

    redis.on('connect', () => {
      console.log('Redis connected successfully');
    });

    return redis;
  } catch (error) {
    console.warn('Failed to initialize Redis:', (error as Error).message);
    return undefined;
  }
}

connection = initializeRedisConnection();

export interface NotificationJob {
  eventType: string;
  workflowInstanceId: string;
  entityId: string;
  entityType: string;
  data: Record<string, any>;
  timestamp: Date;
}

export class NotificationQueue {
  private queue: Queue<NotificationJob> | null = null;
  private worker: Worker<NotificationJob> | null = null;
  private redisConnected = false;

  constructor() {
    if (!connection) {
      console.warn('NotificationQueue: Redis not available, using in-memory processing');
      return;
    }

    try {
      this.setupQueue();
    } catch (error) {
      console.warn('Failed to setup queue, using in-memory processing:', (error as Error).message);
      this.queue = null;
      this.worker = null;
    }
  }

  private setupQueue(): void {
    if (!connection) return;

    this.queue = new Queue<NotificationJob>('workflow-notification', {
      connection: connection as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
        },
        removeOnFail: {
          count: 1000,
        },
      },
    });

    this.queue.on('error', (error) => {
      console.warn('Queue error:', error.message);
      this.redisConnected = false;
    });

    this.queue.on('ready', () => {
      this.redisConnected = true;
      console.log('NotificationQueue ready');
    });

    try {
      this.worker = new Worker<NotificationJob>(
        'workflow-notification',
        async (job: Job<NotificationJob>) => {
          return await this.processNotification(job.data);
        },
        {
          connection,
          concurrency: 10,
        }
      );

      this.worker.on('completed', (job) => {
        console.log(`Notification job ${job.id} completed`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`Notification job ${job?.id} failed:`, err);
      });

      this.worker.on('error', (error) => {
        console.warn('Worker error:', error.message);
      });
    } catch (error) {
      console.warn('Failed to setup worker:', (error as Error).message);
      this.worker = null;
    }
  }

  async addNotificationJob(data: NotificationJob): Promise<void> {
    if (!this.queue || !this.redisConnected) {
      // Process immediately if queue not available
      await this.processNotification(data);
      return;
    }

    try {
      await this.queue.add('notification', data, {
        jobId: `${data.workflowInstanceId}-${data.eventType}-${Date.now()}`,
      });
    } catch (error) {
      console.warn('Failed to add queue job, processing immediately:', (error as Error).message);
      await this.processNotification(data);
    }
  }

  private async processNotification(data: NotificationJob): Promise<void> {
    const notificationServiceUrl = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003';

    try {
      await axios.post(`${notificationServiceUrl}/notifications/workflow`, {
        eventType: data.eventType,
        workflowInstanceId: data.workflowInstanceId,
        entityId: data.entityId,
        entityType: data.entityType,
        data: data.data,
        timestamp: data.timestamp,
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
