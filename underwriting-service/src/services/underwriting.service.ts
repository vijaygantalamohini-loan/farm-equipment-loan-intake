import { CreateUnderwritingRequestDto, UpdateUnderwritingStatusDto } from "../dtos/underwriting.dto";
import { UnderwritingRepository } from "../repositories/underwriting.repository";
import { UnderwritingRequest, UnderwritingStatus } from "../entities/underwriting.entity";
import { enqueueUnderwritingJob } from "../queue/underwriting.queue";

export class UnderwritingService {
  constructor(private repository: UnderwritingRepository) {}

  async createRequest(dto: CreateUnderwritingRequestDto): Promise<UnderwritingRequest> {
    const request = await this.repository.create({
      applicationId: dto.applicationId,
      lenderId: dto.lenderId,
      status: "pending",
      borrowerData: dto.borrowerData,
      loanData: dto.loanData,
      collateralData: dto.collateralData,
    });

    await this.repository.addActivity({
      underwritingId: request.id,
      activityType: "status_change",
      description: "Underwriting request created",
    });

    await enqueueUnderwritingJob({
      type: "process_request",
      underwritingId: request.id,
      data: request,
    });

    return request;
  }

  async getById(id: string): Promise<UnderwritingRequest | null> {
    return this.repository.findById(id);
  }

  async getByApplicationId(applicationId: string): Promise<UnderwritingRequest | null> {
    return this.repository.findByApplicationId(applicationId);
  }

  async updateStatus(id: string, dto: UpdateUnderwritingStatusDto): Promise<UnderwritingRequest | null> {
    const existing = await this.repository.findById(id);
    if (!existing) return null;

    const updates: Partial<UnderwritingRequest> = {
      status: dto.status,
      notes: dto.notes || existing.notes,
    };

    if (dto.decision) {
      updates.decision = dto.decision;
    }

    if (dto.status === "approved" || dto.status === "rejected") {
      updates.completedAt = new Date().toISOString();
    }

    const updated = await this.repository.update(id, updates);

    if (updated) {
      await this.repository.addActivity({
        underwritingId: id,
        activityType: "status_change",
        description: `Status changed to ${dto.status}`,
      });

      if (dto.decision) {
        await this.repository.addActivity({
          underwritingId: id,
          activityType: "decision_made",
          description: dto.decision.approved ? "Loan approved" : "Loan rejected",
        });
      }
    }

    return updated;
  }

  async addNote(id: string, note: string, performedBy?: string): Promise<void> {
    await this.repository.addActivity({
      underwritingId: id,
      activityType: "note_added",
      description: note,
      performedBy,
    });
  }

  async getAll(page?: number, pageSize?: number) {
    return this.repository.getAll({ page, pageSize });
  }

  async getByLender(lenderId: string, page?: number, pageSize?: number) {
    return this.repository.getByLender(lenderId, { page, pageSize });
  }

  async getByStatus(status: UnderwritingStatus, page?: number, pageSize?: number) {
    return this.repository.getByStatus(status, { page, pageSize });
  }

  async getActivities(underwritingId: string) {
    return this.repository.getActivities(underwritingId);
  }

  async processRequest(underwritingId: string): Promise<void> {
    const request = await this.repository.findById(underwritingId);
    if (!request) return;

    await this.repository.update(underwritingId, {
      status: "in_review",
    });

    await this.repository.addActivity({
      underwritingId,
      activityType: "status_change",
      description: "Automated underwriting review started",
    });
  }
}

export const underwritingRepository = new UnderwritingRepository();
export const underwritingService = new UnderwritingService(underwritingRepository);
