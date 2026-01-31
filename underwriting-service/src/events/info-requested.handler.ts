import { underwritingService } from "../services/underwriting.service";

export interface InfoRequestedEvent {
  underwritingId: string;
  requestedInfo: string[];
  notes: string;
}

export async function handleInfoRequested(event: InfoRequestedEvent): Promise<void> {
  await underwritingService.updateStatus(event.underwritingId, {
    status: "more_info_needed",
    notes: event.notes,
  });
}
