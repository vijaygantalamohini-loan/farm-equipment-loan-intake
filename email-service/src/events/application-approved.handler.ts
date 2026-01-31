import { emailService } from "../services/email.service";
import { RecipientType } from "./application-submitted.handler";

export interface ApplicationApprovedEvent {
  recipientType: RecipientType;
  recipientEmail: string;
  recipientName?: string;
  applicationId: string;
  approvalAmount?: string;
  dealerName?: string;
  farmerName?: string;
}

export async function handleApplicationApproved(event: ApplicationApprovedEvent): Promise<void> {
  const template = `${event.recipientType}/application-approved`;
  const subject = "Application Approved";

  await emailService.send({
    to: event.recipientEmail,
    subject,
    template,
    data: {
      ...event,
    },
  });
}
