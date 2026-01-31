import { emailService } from "../services/email.service";

export interface DecisionReadyEvent {
  recipientEmail: string;
  recipientName?: string;
  applicationId: string;
  dealerName?: string;
  farmerName?: string;
}

export async function handleDecisionReady(event: DecisionReadyEvent): Promise<void> {
  await emailService.send({
    to: event.recipientEmail,
    subject: "Decision Ready",
    template: "lender/decision-ready",
    data: {
      ...event,
    },
  });
}
