import { emailService } from "../services/email.service";
import { startEmailProcessor } from "./email.queue";

export async function startProcessor(): Promise<void> {
  await startEmailProcessor(async job => {
    await emailService.process(job);
  });
}
