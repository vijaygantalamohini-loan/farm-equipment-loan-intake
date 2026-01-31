import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

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

export interface StateTransitionJob {
  workflowInstanceId: string;
  toState: string;
  trigger?: string;
  triggeredBy?: string;
  context?: Record<string, any>;
}

export class StateTransitionQueue {
  private queue: Queue<StateTransitionJob> | null = null;
  private worker: Worker<StateTransitionJob> | null = null;
  private redisConnected = false;

  constructor() {
    if (!connection) {
      console.warn('StateTransitionQueue: Redis not available, using in-memory processing');
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

    this.queue = new Queue<StateTransitionJob>('state-transition', {
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
      console.log('StateTransitionQueue ready');
    });

    try {
      this.worker = new Worker<StateTransitionJob>(
        'state-transition',
        async (job: Job<StateTransitionJob>) => {
          return await this.processStateTransition(job.data);
        },
        {
          connection,
          concurrency: 10,
        }
      );

      this.worker.on('completed', (job) => {
        console.log(`State transition job ${job.id} completed`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`State transition job ${job?.id} failed:`, err);
      });

      this.worker.on('error', (error) => {
        console.warn('Worker error:', error.message);
      });
    } catch (error) {
      console.warn('Failed to setup worker:', (error as Error).message);
      this.worker = null;
    }
  }

  async addStateTransitionJob(data: StateTransitionJob): Promise<void> {
    if (!this.queue || !this.redisConnected) {
      // Process immediately if queue not available
      await this.processStateTransition(data);
      return;
    }
    
    try {
      await this.queue.add('transition', data, {
        jobId: `${data.workflowInstanceId}-${data.toState}-${Date.now()}`,
      });
    } catch (error) {
      console.warn('Failed to add queue job, processing immediately:', (error as Error).message);
      await this.processStateTransition(data);
    }
  }

  private async processStateTransition(data: StateTransitionJob): Promise<void> {
    const { WorkflowInstanceService } = await import('../services/WorkflowInstanceService');
    const service = new WorkflowInstanceService();

    await service.transition(data.workflowInstanceId, {
      toState: data.toState,
      trigger: data.trigger,
      triggeredBy: data.triggeredBy,
    if (this.worker) await this.worker.close();
    if (this.queue) });
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}
