import { notificationService } from "../services/notification.service";
import { startNotificationProcessor } from "./notification.queue";

export async function startProcessor(): Promise<void> {
  await startNotificationProcessor(async job => {
    await notificationService.process(job);
  });
}
