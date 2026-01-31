import { emailService } from "../services/email.service";

export type RecipientType = "dealer" | "farmer" | "lender";

export interface ApplicationSubmittedEvent {
  recipientType: RecipientType;
  recipientEmail: string;
  recipientName?: string;
  applicationId: string;
  dealerName?: string;
  farmerName?: string;
}

export async function handleApplicationSubmitted(event: ApplicationSubmittedEvent): Promise<void> {
  const template = `${event.recipientType}/application-submitted`;
  const subject = "Application Submitted";

  await emailService.send({
    to: event.recipientEmail,
    subject,
    template,
    data: {
      ...event,
    },
  });
}
