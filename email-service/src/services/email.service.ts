import { SendEmailDto } from "../dtos/send-email.dto";
import { EmailRepository } from "../repositories/email.repository";
import { TemplateService } from "../utils/template.service";
import { getEmailAdapter } from "../adapters";
import { enqueueEmail } from "../queue/email.queue";

export class EmailService {
  constructor(
    private repository: EmailRepository,
    private templateService: TemplateService
  ) {}

  async send(dto: SendEmailDto): Promise<{ jobId: string }> {
    const job = await enqueueEmail(dto);
    await this.repository.saveLog({
      to: dto.to,
      subject: dto.subject,
      body: "",
      status: "queued",
    });
    return { jobId: job.id };
  }

  async process(dto: SendEmailDto): Promise<void> {
    const adapter = getEmailAdapter();
    const body = await this.templateService.loadTemplate(dto.template, dto.data || {});

    try {
      const result = await adapter.send(dto.to, dto.subject, body);
      await this.repository.saveLog({
        to: dto.to,
        subject: dto.subject,
        body,
        status: "sent",
        provider: result.provider,
        messageId: result.messageId,
      });
    } catch (error) {
      await this.repository.saveLog({
        to: dto.to,
        subject: dto.subject,
        body,
        status: "failed",
      });
      await this.repository.saveFailure({
        payload: dto,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getLogs(page?: number, pageSize?: number) {
    return this.repository.getLogs({ page, pageSize });
  }
}

export const emailRepository = new EmailRepository();
export const templateService = new TemplateService();
export const emailService = new EmailService(emailRepository, templateService);
