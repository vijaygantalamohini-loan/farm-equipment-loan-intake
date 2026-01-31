import { NotificationChannel } from "../dtos/send-notification.dto";

export type NotificationStatus = "queued" | "sent" | "failed" | "delivered";

export interface NotificationLog {
  id: string;
  recipientId: string;
  channel: NotificationChannel;
  title?: string;
  message: string;
  status: NotificationStatus;
  provider?: string;
  referenceId?: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface NotificationFailure {
  id: string;
  payload: unknown;
  error: string;
  createdAt: string;
}
