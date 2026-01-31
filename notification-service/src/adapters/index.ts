import { NotificationAdapter } from "./notification.adapter";
import { TwilioSmsAdapter } from "./twilio-sms.adapter";
import { FirebasePushAdapter } from "./firebase-push.adapter";
import { InAppAdapter } from "./inapp.adapter";
import { NotificationChannel } from "../dtos/send-notification.dto";

export function getNotificationAdapter(channel: NotificationChannel): NotificationAdapter {
  switch (channel) {
    case "sms":
      return new TwilioSmsAdapter();
    case "push":
      return new FirebasePushAdapter();
    case "inapp":
      return new InAppAdapter();
    default:
      throw new Error(`Unknown notification channel: ${channel}`);
  }
}
