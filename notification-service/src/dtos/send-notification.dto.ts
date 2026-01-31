import { z } from "zod";

export type NotificationChannel = "sms" | "push" | "inapp";

export const SendNotificationDtoSchema = z.object({
  channel: z.enum(["sms", "push", "inapp"]),
  recipientId: z.string(),
  title: z.string().optional(),
  message: z.string(),
  data: z.record(z.any()).optional(),
  phoneNumber: z.string().optional(),
});

export type SendNotificationDto = z.infer<typeof SendNotificationDtoSchema>;
