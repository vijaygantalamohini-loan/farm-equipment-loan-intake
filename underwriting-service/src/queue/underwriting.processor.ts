import { underwritingService } from "../services/underwriting.service";
import { startUnderwritingProcessor } from "./underwriting.queue";

export async function startProcessor(): Promise<void> {
  await startUnderwritingProcessor(async job => {
    if (job.type === "process_request") {
      await underwritingService.processRequest(job.underwritingId);
    }
  });
}
