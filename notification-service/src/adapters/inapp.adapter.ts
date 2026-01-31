import { NotificationAdapter, SendResult } from "./notification.adapter";
import { SendNotificationDto } from "../dtos/send-notification.dto";

export class InAppAdapter implements NotificationAdapter {
  async send(payload: SendNotificationDto): Promise<SendResult> {
    const notificationId = `in-app-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      provider: "in-app",
      referenceId: notificationId,
    };
  }
}
