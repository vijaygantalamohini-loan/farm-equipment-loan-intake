import { emailService } from "../services/email.service";

export interface UnderwritingRequestedEvent {
  recipientEmail: string;
  recipientName?: string;
  applicationId: string;
  dealerName?: string;
  farmerName?: string;
}

export async function handleUnderwritingRequested(event: UnderwritingRequestedEvent): Promise<void> {
  await emailService.send({
    to: event.recipientEmail,
    subject: "Underwriting Request",
    template: "lender/underwriting-request",
    data: {
      ...event,
    },
  });
}
