import { Request, Response } from "express";
import { SendEmailDtoSchema } from "../dtos/send-email.dto";
import { emailService } from "../services/email.service";

export class EmailController {
  async send(req: Request, res: Response): Promise<void> {
    const parsed = SendEmailDtoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await emailService.send(parsed.data);
    res.status(202).json({ status: "queued", ...result });
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.page_size ? Number(req.query.page_size) : 25;
    const logs = await emailService.getLogs(page, pageSize);
    res.json(logs);
  }
}
