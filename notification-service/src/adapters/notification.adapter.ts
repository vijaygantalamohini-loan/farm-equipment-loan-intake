import { SendNotificationDto } from "../dtos/send-notification.dto";

export interface SendResult {
  success: boolean;
  provider: string;
  referenceId?: string;
}

export interface NotificationAdapter {
  send(payload: SendNotificationDto): Promise<SendResult>;
}
