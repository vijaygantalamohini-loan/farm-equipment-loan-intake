import { underwritingService } from "../services/underwriting.service";

export interface UnderwritingCompletedEvent {
  underwritingId: string;
  applicationId: string;
  approved: boolean;
  decision: any;
}

export async function handleUnderwritingCompleted(event: UnderwritingCompletedEvent): Promise<void> {
  const status = event.approved ? "approved" : "rejected";
  await underwritingService.updateStatus(event.underwritingId, {
    status,
    decision: event.decision,
  });
}
