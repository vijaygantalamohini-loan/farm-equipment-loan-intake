import { Request, Response } from "express";
import { SendNotificationDtoSchema } from "../dtos/send-notification.dto";
import { notificationService } from "../services/notification.service";

export class NotificationController {
  async send(req: Request, res: Response): Promise<void> {
    const parsed = SendNotificationDtoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await notificationService.send(parsed.data);
    res.status(202).json({ status: "queued", ...result });
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.page_size ? Number(req.query.page_size) : 25;
    const logs = await notificationService.getLogs(page, pageSize);
    res.json(logs);
  }

  async getRecipientNotifications(req: Request, res: Response): Promise<void> {
    const { recipientId } = req.params;
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.page_size ? Number(req.query.page_size) : 25;
    const logs = await notificationService.getRecipientNotifications(recipientId, page, pageSize);
    res.json(logs);
  }
}
