import { Queue, Worker, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import amqplib, { ConsumeMessage } from "amqplib";
import { SendNotificationDto } from "../dtos/send-notification.dto";

export type NotificationJob = SendNotificationDto;

export interface NotificationQueueProvider {
  enqueue(job: NotificationJob): Promise<{ id: string }>;
  startProcessor(handler: (job: NotificationJob) => Promise<void>): Promise<void>;
}

const DEFAULT_QUEUE = "notification-jobs";
const MAX_RETRIES = 3;

class BullMqProvider implements NotificationQueueProvider {
  private queue: Queue;
  private dlq: Queue;

  constructor() {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    const queueName = process.env.NOTIFICATION_QUEUE_NAME || DEFAULT_QUEUE;
    this.queue = new Queue(queueName, { connection });
    this.dlq = new Queue(`${queueName}.dlq`, { connection });
    new QueueEvents(queueName, { connection });
  }

  async enqueue(job: NotificationJob): Promise<{ id: string }> {
    const result = await this.queue.add("send-notification", job, {
      attempts: MAX_RETRIES,
      backoff: { type: "exponential", delay: 1000 },
    });
    return { id: String(result.id) };
  }

  async startProcessor(handler: (job: NotificationJob) => Promise<void>): Promise<void> {
    const queueName = this.queue.name;
    const dlq = this.dlq;

    const worker = new Worker(
      queueName,
      async job => {
        await handler(job.data as NotificationJob);
      },
      {
        connection: this.queue.opts.connection as IORedis,
      }
    );

    worker.on("failed", async (job, err) => {
      if (!job) return;
      if (job.attemptsMade >= MAX_RETRIES) {
        await dlq.add("send-notification", job.data, {
          removeOnComplete: true,
        });
      }
      console.error("Notification job failed", { id: job.id, err });
    });
  }
}

class RabbitMqProvider implements NotificationQueueProvider {
  private connection?: amqplib.Connection;
  private channel?: amqplib.Channel;
  private queueName: string;
  private dlqName: string;

  constructor() {
    this.queueName = process.env.NOTIFICATION_QUEUE_NAME || DEFAULT_QUEUE;
    this.dlqName = `${this.queueName}.dlq`;
  }

  private async ensureChannel(): Promise<amqplib.Channel> {
    if (this.channel) return this.channel;
    const url = process.env.RABBITMQ_URL || "amqp://localhost";
    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertQueue(this.queueName, { durable: true });
    await this.channel.assertQueue(this.dlqName, { durable: true });
    return this.channel;
  }

  async enqueue(job: NotificationJob): Promise<{ id: string }> {
    const channel = await this.ensureChannel();
    const id = Date.now().toString();
    channel.sendToQueue(this.queueName, Buffer.from(JSON.stringify(job)), {
      persistent: true,
      messageId: id,
      headers: { "x-retry-count": 0 },
    });
    return { id };
  }

  async startProcessor(handler: (job: NotificationJob) => Promise<void>): Promise<void> {
    const channel = await this.ensureChannel();
    channel.prefetch(5);

    await channel.consume(this.queueName, async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      const retryCount = Number(msg.properties.headers?.["x-retry-count"] || 0);
      try {
        const payload = JSON.parse(msg.content.toString()) as NotificationJob;
        await handler(payload);
        channel.ack(msg);
      } catch (err) {
        if (retryCount + 1 >= MAX_RETRIES) {
          channel.sendToQueue(this.dlqName, msg.content, {
            persistent: true,
            headers: { "x-retry-count": retryCount + 1 },
          });
          channel.ack(msg);
        } else {
          channel.sendToQueue(this.queueName, msg.content, {
            persistent: true,
            headers: { "x-retry-count": retryCount + 1 },
          });
          channel.ack(msg);
        }
        console.error("Notification job failed", err);
      }
    });
  }
}

let provider: NotificationQueueProvider | null = null;

export function getNotificationQueueProvider(): NotificationQueueProvider {
  if (provider) return provider;
  const selected = (process.env.QUEUE_PROVIDER || "bullmq").toLowerCase();
  provider = selected === "rabbitmq" ? new RabbitMqProvider() : new BullMqProvider();
  return provider;
}

export async function enqueueNotification(job: NotificationJob): Promise<{ id: string }> {
  const queue = getNotificationQueueProvider();
  return queue.enqueue(job);
}

export async function startNotificationProcessor(handler: (job: NotificationJob) => Promise<void>): Promise<void> {
  const queue = getNotificationQueueProvider();
  await queue.startProcessor(handler);
}
