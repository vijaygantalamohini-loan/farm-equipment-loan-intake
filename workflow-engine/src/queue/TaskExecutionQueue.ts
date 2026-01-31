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

export interface TaskExecutionJob {
  taskId: string;
  workflowInstanceId: string;
  taskType: string;
  input: Record<string, any>;
}

export class TaskExecutionQueue {
  private queue: Queue<TaskExecutionJob> | null = null;
  private worker: Worker<TaskExecutionJob> | null = null;
  private redisConnected = false;

  constructor() {
    if (!connection) {
      console.warn('TaskExecutionQueue: Redis not available, using in-memory processing');
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

    this.queue = new Queue<TaskExecutionJob>('task-execution', {
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
      console.log('TaskExecutionQueue ready');
    });

    try {
      this.worker = new Worker<TaskExecutionJob>(
        'task-execution',
        async (job: Job<TaskExecutionJob>) => {
          return await this.processTask(job.data);
        },
        {
          connection,
          concurrency: 5,
        }
      );

      this.worker.on('completed', (job) => {
        console.log(`Task execution job ${job.id} completed`);
      });

      this.worker.on('failed', (job, err) => {
        console.error(`Task execution job ${job?.id} failed:`, err);
      });

      this.worker.on('error', (error) => {
        console.warn('Worker error:', error.message);
      });
    } catch (error) {
      console.warn('Failed to setup worker:', (error as Error).message);
      this.worker = null;
    }
  }

  async addTaskExecutionJob(data: TaskExecutionJob): Promise<void> {
    if (!this.queue || !this.redisConnected) {
      // Process immediately if queue not available
      await this.processTask(data);
      return;
    }

    try {
      await this.queue.add('execute', data, {
        jobId: `${data.taskId}-${Date.now()}`,
      });
    } catch (error) {
      console.warn('Failed to add queue job, processing immediately:', (error as Error).message);
      await this.processTask(data);
    }
  }

  private async processTask(data: TaskExecutionJob): Promise<void> {
    const { WorkflowTaskService } = await import('../services/WorkflowTaskService');
    const service = new WorkflowTaskService();

    try {
      await service.startTask(data.taskId);

      const output = await this.executeTaskLogic(data);

      await service.completeTask(data.taskId, output);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await service.failTask(data.taskId, errorMessage);
      throw error;
    }
  }

  private async executeTaskLogic(data: TaskExecutionJob): Promise<Record<string, any>> {
    switch (data.taskType) {
      case 'validate_application':
        return await this.validateApplication(data.input);
      case 'request_underwriting':
        return await this.requestUnderwriting(data.input);
      case 'process_decision':
        return await this.processDecision(data.input);
      case 'send_notification':
        return await this.sendNotification(data.input);
      default:
        throw new Error(`Unknown task type: ${data.taskType}`);
    }
  }

  private async validateApplication(input: Record<string, any>): Promise<Record<string, any>> {
    return { validated: true, timestamp: new Date().toISOString() };
  }

  private async requestUnderwriting(input: Record<string, any>): Promise<Record<string, any>> {
    return { requested: true, timestamp: new Date().toISOString() };
  }

  private async processDecision(input: Record<string, any>): Promise<Record<string, any>> {
    return { processed: true, timestamp: new Date().toISOString() };
  }

  private async sendNotification(input: Record<string, any>): Promise<Record<string, any>> {
    return { sent: true, timestamp: new Date().toISOString() };
  }

  async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
