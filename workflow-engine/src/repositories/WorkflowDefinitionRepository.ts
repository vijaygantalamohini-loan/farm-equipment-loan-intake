import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { WorkflowDefinition, WorkflowType } from '../entities/WorkflowDefinition';

export class WorkflowDefinitionRepository {
  private repository: Repository<WorkflowDefinition>;

  constructor() {
    this.repository = AppDataSource.getRepository(WorkflowDefinition);
  }

  async create(data: Partial<WorkflowDefinition>): Promise<WorkflowDefinition> {
    const definition = this.repository.create(data);
    return await this.repository.save(definition);
  }

  async findById(id: string): Promise<WorkflowDefinition | null> {
    return await this.repository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<WorkflowDefinition | null> {
    return await this.repository.findOne({ where: { name, isActive: true } });
  }

  async findByType(type: WorkflowType): Promise<WorkflowDefinition[]> {
    return await this.repository.find({
      where: { type, isActive: true },
      order: { version: 'DESC' },
    });
  }

  async findAll(filters?: { isActive?: boolean }): Promise<WorkflowDefinition[]> {
    const where: any = {};
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    return await this.repository.find({ where, order: { createdAt: 'DESC' } });
  }

  async update(id: string, data: Partial<WorkflowDefinition>): Promise<WorkflowDefinition | null> {
    await this.repository.update(id, data);
    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async deactivate(id: string): Promise<WorkflowDefinition | null> {
    return await this.update(id, { isActive: false });
  }

  async getLatestVersion(name: string): Promise<WorkflowDefinition | null> {
    return await this.repository.findOne({
      where: { name, isActive: true },
      order: { version: 'DESC' },
    });
  }
}
