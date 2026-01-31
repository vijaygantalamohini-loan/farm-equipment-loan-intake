import { Repository, In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkflowTask, TaskStatus } from '../entities/WorkflowTask';

export interface WorkflowTaskFilters {
  workflowInstanceId?: string;
  status?: TaskStatus;
  assignedTo?: string;
  assignedRole?: string;
  type?: string;
}

export class WorkflowTaskRepository {
  private repository: Repository<WorkflowTask>;

  constructor() {
    this.repository = AppDataSource.getRepository(WorkflowTask);
  }

  async create(data: Partial<WorkflowTask>): Promise<WorkflowTask> {
    const task = this.repository.create(data);
    return await this.repository.save(task);
  }

  async findById(id: string): Promise<WorkflowTask | null> {
    return await this.repository.findOne({
      where: { id },
      relations: ['workflowInstance'],
    });
  }

  async findAll(
    filters: WorkflowTaskFilters,
    page: number = 1,
    pageSize: number = 25
  ): Promise<{ items: WorkflowTask[]; total: number }> {
    const where: any = {};

    if (filters.workflowInstanceId) where.workflowInstanceId = filters.workflowInstanceId;
    if (filters.status) where.status = filters.status;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters.assignedRole) where.assignedRole = filters.assignedRole;
    if (filters.type) where.type = filters.type;

    const [items, total] = await this.repository.findAndCount({
      where,
      relations: ['workflowInstance'],
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async findByWorkflowInstance(workflowInstanceId: string): Promise<WorkflowTask[]> {
    return await this.repository.find({
      where: { workflowInstanceId },
      order: { createdAt: 'ASC' },
    });
  }

  async findPendingTasks(assignedTo?: string): Promise<WorkflowTask[]> {
    const where: any = { status: TaskStatus.PENDING };
    if (assignedTo) where.assignedTo = assignedTo;

    return await this.repository.find({
      where,
      relations: ['workflowInstance'],
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  async findOverdueTasks(): Promise<WorkflowTask[]> {
    return await this.repository
      .createQueryBuilder('task')
      .where('task.status IN (:...statuses)', {
        statuses: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS],
      })
      .andWhere('task.due_date < :now', { now: new Date() })
      .leftJoinAndSelect('task.workflowInstance', 'workflowInstance')
      .orderBy('task.due_date', 'ASC')
      .getMany();
  }

  async update(id: string, data: Partial<WorkflowTask>): Promise<WorkflowTask | null> {
    await this.repository.update(id, data);
    return await this.findById(id);
  }

  async updateStatus(id: string, status: TaskStatus): Promise<WorkflowTask | null> {
    const updateData: any = { status, updatedAt: new Date() };

    if (status === TaskStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    } else if (status === TaskStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    await this.repository.update(id, updateData);
    return await this.findById(id);
  }

  async incrementRetryCount(id: string): Promise<WorkflowTask | null> {
    const task = await this.findById(id);
    if (!task) return null;

    task.retryCount += 1;
    return await this.repository.save(task);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async countByStatus(workflowInstanceId: string): Promise<Record<string, number>> {
    const results = await this.repository
      .createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.workflow_instance_id = :workflowInstanceId', { workflowInstanceId })
      .groupBy('task.status')
      .getRawMany();

    return results.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);
  }
}
