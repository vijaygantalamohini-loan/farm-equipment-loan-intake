import { Request, Response } from "express";
import { CreateUnderwritingRequestDtoSchema, UpdateUnderwritingStatusDtoSchema } from "../dtos/underwriting.dto";
import { underwritingService } from "../services/underwriting.service";

export class UnderwritingController {
  async create(req: Request, res: Response): Promise<void> {
    const parsed = CreateUnderwritingRequestDtoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await underwritingService.createRequest(parsed.data);
    res.status(201).json(result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await underwritingService.getById(id);
    if (!result) {
      res.status(404).json({ error: "Underwriting request not found" });
      return;
    }
    res.json(result);
  }

  async getByApplicationId(req: Request, res: Response): Promise<void> {
    const { applicationId } = req.params;
    const result = await underwritingService.getByApplicationId(applicationId);
    if (!result) {
      res.status(404).json({ error: "Underwriting request not found" });
      return;
    }
    res.json(result);
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const parsed = UpdateUnderwritingStatusDtoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid payload",
        details: parsed.error.flatten(),
      });
      return;
    }

    const result = await underwritingService.updateStatus(id, parsed.data);
    if (!result) {
      res.status(404).json({ error: "Underwriting request not found" });
      return;
    }
    res.json(result);
  }

  async addNote(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { note, performedBy } = req.body;
    if (!note || typeof note !== "string") {
      res.status(400).json({ error: "Note is required" });
      return;
    }

    await underwritingService.addNote(id, note, performedBy);
    res.status(201).json({ success: true });
  }

  async getAll(req: Request, res: Response): Promise<void> {
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.page_size ? Number(req.query.page_size) : 25;
    const result = await underwritingService.getAll(page, pageSize);
    res.json(result);
  }

  async getByLender(req: Request, res: Response): Promise<void> {
    const { lenderId } = req.params;
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.page_size ? Number(req.query.page_size) : 25;
    const result = await underwritingService.getByLender(lenderId, page, pageSize);
    res.json(result);
  }

  async getByStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.params;
    const page = req.query.page ? Number(req.query.page) : 1;
    const pageSize = req.query.page_size ? Number(req.query.page_size) : 25;
    const result = await underwritingService.getByStatus(status as any, page, pageSize);
    res.json(result);
  }

  async getActivities(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const result = await underwritingService.getActivities(id);
    res.json(result);
  }
}
