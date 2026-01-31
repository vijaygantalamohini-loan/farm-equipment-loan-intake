import { emailService } from "../services/email.service";
import { RecipientType } from "./application-submitted.handler";

export interface ApplicationRejectedEvent {
  recipientType: RecipientType;
  recipientEmail: string;
  recipientName?: string;
  applicationId: string;
  reason?: string;
  dealerName?: string;
  farmerName?: string;
}

export async function handleApplicationRejected(event: ApplicationRejectedEvent): Promise<void> {
  const template = `${event.recipientType}/application-rejected`;
  const subject = "Application Rejected";

  await emailService.send({
    to: event.recipientEmail,
    subject,
    template,
    data: {
      ...event,
    },
  });
}
