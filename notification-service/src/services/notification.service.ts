import { SendNotificationDto } from "../dtos/send-notification.dto";
import { NotificationRepository } from "../repositories/notification.repository";
import { getNotificationAdapter } from "../adapters";
import { enqueueNotification } from "../queue/notification.queue";

export class NotificationService {
  constructor(private repository: NotificationRepository) {}

  async send(dto: SendNotificationDto): Promise<{ jobId: string }> {
    const job = await enqueueNotification(dto);
    await this.repository.saveLog({
      recipientId: dto.recipientId,
      channel: dto.channel,
      title: dto.title,
      message: dto.message,
      status: "queued",
    });
    return { jobId: job.id };
  }

  async process(dto: SendNotificationDto): Promise<void> {
    const adapter = getNotificationAdapter(dto.channel);

    try {
      const result = await adapter.send(dto);
      await this.repository.saveLog({
        recipientId: dto.recipientId,
        channel: dto.channel,
        title: dto.title,
        message: dto.message,
        status: "sent",
        provider: result.provider,
        referenceId: result.referenceId,
      });
    } catch (error) {
      await this.repository.saveLog({
        recipientId: dto.recipientId,
        channel: dto.channel,
        title: dto.title,
        message: dto.message,
        status: "failed",
      });
      await this.repository.saveFailure({
        payload: dto,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getLogs(page?: number, pageSize?: number) {
    return this.repository.getLogs({ page, pageSize });
  }

  async getRecipientNotifications(recipientId: string, page?: number, pageSize?: number) {
    return this.repository.getByRecipient(recipientId, { page, pageSize });
  }
}

export const notificationRepository = new NotificationRepository();
export const notificationService = new NotificationService(notificationRepository);
