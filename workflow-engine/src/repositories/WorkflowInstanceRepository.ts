import { Repository, In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkflowInstance, WorkflowStatus } from '../entities/WorkflowInstance';

export interface WorkflowInstanceFilters {
  status?: WorkflowStatus;
  entityType?: string;
  entityId?: string;
  tenantId?: string;
  workflowDefinitionId?: string;
  currentState?: string;
}

export class WorkflowInstanceRepository {
  private repository: Repository<WorkflowInstance>;

  constructor() {
    this.repository = AppDataSource.getRepository(WorkflowInstance);
  }

  async create(data: Partial<WorkflowInstance>): Promise<WorkflowInstance> {
    const instance = this.repository.create(data);
    return await this.repository.save(instance);
  }

  async findById(id: string, relations?: string[]): Promise<WorkflowInstance | null> {
    return await this.repository.findOne({
      where: { id },
      relations: relations || ['workflowDefinition'],
    });
  }

  async findByEntityId(entityId: string, entityType: string): Promise<WorkflowInstance[]> {
    return await this.repository.find({
      where: { entityId, entityType },
      relations: ['workflowDefinition'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(
    filters: WorkflowInstanceFilters,
    page: number = 1,
    pageSize: number = 25,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<{ items: WorkflowInstance[]; total: number }> {
    const where: any = {};

    if (filters.status) where.status = filters.status;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.tenantId) where.tenantId = filters.tenantId;
    if (filters.workflowDefinitionId) where.workflowDefinitionId = filters.workflowDefinitionId;
    if (filters.currentState) where.currentState = filters.currentState;

    const [items, total] = await this.repository.findAndCount({
      where,
      relations: ['workflowDefinition'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { [sortBy]: sortOrder },
    });

    return { items, total };
  }

  async update(id: string, data: Partial<WorkflowInstance>): Promise<WorkflowInstance | null> {
    await this.repository.update(id, data);
    return await this.findById(id);
  }

  async updateState(
    id: string,
    currentState: string,
    previousState: string
  ): Promise<WorkflowInstance | null> {
    await this.repository.update(id, { currentState, previousState, updatedAt: new Date() });
    return await this.findById(id);
  }

  async updateStatus(id: string, status: WorkflowStatus): Promise<WorkflowInstance | null> {
    const updateData: any = { status, updatedAt: new Date() };

    if (status === WorkflowStatus.ACTIVE && !await this.hasStarted(id)) {
      updateData.startedAt = new Date();
    } else if (status === WorkflowStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (status === WorkflowStatus.FAILED) {
      updateData.failedAt = new Date();
    }

    await this.repository.update(id, updateData);
    return await this.findById(id);
  }

  async incrementRetryCount(id: string): Promise<WorkflowInstance | null> {
    const instance = await this.findById(id);
    if (!instance) return null;

    instance.retryCount += 1;
    return await this.repository.save(instance);
  }

  async updateContext(
    id: string,
    context: Record<string, any>,
    merge: boolean = true
  ): Promise<WorkflowInstance | null> {
    const instance = await this.findById(id);
    if (!instance) return null;

    instance.context = merge ? { ...instance.context, ...context } : context;
    return await this.repository.save(instance);
  }

  async findActiveByEntityType(entityType: string): Promise<WorkflowInstance[]> {
    return await this.repository.find({
      where: {
        entityType,
        status: In([WorkflowStatus.PENDING, WorkflowStatus.ACTIVE]),
      },
      relations: ['workflowDefinition'],
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  private async hasStarted(id: string): Promise<boolean> {
    const instance = await this.findById(id);
    return instance?.startedAt !== null;
  }
}
