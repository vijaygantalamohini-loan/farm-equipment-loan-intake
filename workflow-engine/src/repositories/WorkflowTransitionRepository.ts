import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkflowTransition } from '../entities/WorkflowTransition';

export class WorkflowTransitionRepository {
  private repository: Repository<WorkflowTransition>;

  constructor() {
    this.repository = AppDataSource.getRepository(WorkflowTransition);
  }

  async create(data: Partial<WorkflowTransition>): Promise<WorkflowTransition> {
    const transition = this.repository.create(data);
    return await this.repository.save(transition);
  }

  async findById(id: string): Promise<WorkflowTransition | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findByWorkflowInstance(
    workflowInstanceId: string,
    page: number = 1,
    pageSize: number = 25
  ): Promise<{ items: WorkflowTransition[]; total: number }> {
    const [items, total] = await this.repository.findAndCount({
      where: { workflowInstanceId },
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });

    return { items, total };
  }

  async getHistory(workflowInstanceId: string): Promise<WorkflowTransition[]> {
    return await this.repository.find({
      where: { workflowInstanceId },
      order: { createdAt: 'ASC' },
    });
  }

  async getLatestTransition(workflowInstanceId: string): Promise<WorkflowTransition | null> {
    return await this.repository.findOne({
      where: { workflowInstanceId },
      order: { createdAt: 'DESC' },
    });
  }

  async countTransitions(workflowInstanceId: string): Promise<number> {
    return await this.repository.count({ where: { workflowInstanceId } });
  }

  async getAverageTransitionTime(fromState: string, toState: string): Promise<number | null> {
    const result = await this.repository
      .createQueryBuilder('transition')
      .select('AVG(transition.duration_ms)', 'avgDuration')
      .where('transition.from_state = :fromState', { fromState })
      .andWhere('transition.to_state = :toState', { toState })
      .andWhere('transition.duration_ms IS NOT NULL')
      .getRawOne();

    return result?.avgDuration ? parseFloat(result.avgDuration) : null;
  }
}
