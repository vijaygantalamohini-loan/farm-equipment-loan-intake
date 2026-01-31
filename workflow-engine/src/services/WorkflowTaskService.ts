import { WorkflowTaskRepository, WorkflowTaskFilters } from '../repositories/WorkflowTaskRepository';
import { WorkflowTask, TaskStatus } from '../entities/WorkflowTask';
import { CreateWorkflowTaskDto, UpdateWorkflowTaskDto, PaginatedResponse } from '../dtos/workflow.dto';
import { EventEmitter } from '../events/EventEmitter';
import { WorkflowEventType } from '../events/types';

export class WorkflowTaskService {
  private repository: WorkflowTaskRepository;
  private eventEmitter: EventEmitter;

  constructor() {
    this.repository = new WorkflowTaskRepository();
    this.eventEmitter = EventEmitter.getInstance();
  }

  async createTask(dto: CreateWorkflowTaskDto): Promise<WorkflowTask> {
    const task = await this.repository.create({
      workflowInstanceId: dto.workflowInstanceId,
      name: dto.name,
      type: dto.type,
      description: dto.description,
      priority: dto.priority as any,
      assignedTo: dto.assignedTo,
      assignedRole: dto.assignedRole,
      input: dto.input,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: TaskStatus.PENDING,
      metadata: dto.metadata,
    });

    await this.eventEmitter.emit({
      type: WorkflowEventType.TASK_CREATED,
      workflowInstanceId: task.workflowInstanceId,
      taskId: task.id,
      taskName: task.name,
      taskType: task.type,
      assignedTo: task.assignedTo,
      timestamp: new Date(),
    });

    return task;
  }

  async getTaskById(id: string): Promise<WorkflowTask> {
    const task = await this.repository.findById(id);
    if (!task) {
      throw new Error(`Task with id ${id} not found`);
    }
    return task;
  }

  async getTasks(
    filters: WorkflowTaskFilters,
    page: number = 1,
    pageSize: number = 25
  ): Promise<PaginatedResponse<WorkflowTask>> {
    const { items, total } = await this.repository.findAll(filters, page, pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getTasksByWorkflowInstance(workflowInstanceId: string): Promise<WorkflowTask[]> {
    return await this.repository.findByWorkflowInstance(workflowInstanceId);
  }

  async getPendingTasks(assignedTo?: string): Promise<WorkflowTask[]> {
    return await this.repository.findPendingTasks(assignedTo);
  }

  async getOverdueTasks(): Promise<WorkflowTask[]> {
    return await this.repository.findOverdueTasks();
  }

  async updateTask(id: string, dto: UpdateWorkflowTaskDto): Promise<WorkflowTask> {
    const task = await this.getTaskById(id);

    const updated = await this.repository.update(id, {
      status: dto.status as any,
      output: dto.output,
      errorMessage: dto.errorMessage,
      metadata: dto.metadata,
      updatedAt: new Date(),
    } as any);

    if (!updated) {
      throw new Error(`Failed to update task ${id}`);
    }

    if (dto.status && dto.status !== task.status) {
      await this.eventEmitter.emit({
        type: WorkflowEventType.TASK_STATUS_CHANGED,
        workflowInstanceId: updated.workflowInstanceId,
        taskId: updated.id,
        taskName: updated.name,
        taskType: updated.type,
        previousStatus: task.status,
        currentStatus: updated.status,
        timestamp: new Date(),
      });
    }

    return updated;
  }

  async startTask(id: string): Promise<WorkflowTask> {
    const updated = await this.repository.updateStatus(id, TaskStatus.IN_PROGRESS);
    if (!updated) {
      throw new Error(`Failed to start task ${id}`);
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.TASK_STARTED,
      workflowInstanceId: updated.workflowInstanceId,
      taskId: updated.id,
      taskName: updated.name,
      taskType: updated.type,
      timestamp: new Date(),
    });

    return updated;
  }

  async completeTask(id: string, output?: Record<string, any>): Promise<WorkflowTask> {
    const task = await this.getTaskById(id);

    const updated = await this.repository.update(id, {
      status: TaskStatus.COMPLETED,
      output,
      completedAt: new Date(),
    });

    if (!updated) {
      throw new Error(`Failed to complete task ${id}`);
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.TASK_COMPLETED,
      workflowInstanceId: updated.workflowInstanceId,
      taskId: updated.id,
      taskName: updated.name,
      taskType: updated.type,
      output,
      timestamp: new Date(),
    });

    return updated;
  }

  async failTask(id: string, errorMessage: string): Promise<WorkflowTask> {
    const updated = await this.repository.update(id, {
      status: TaskStatus.FAILED,
      errorMessage,
    });

    if (!updated) {
      throw new Error(`Failed to fail task ${id}`);
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.TASK_FAILED,
      workflowInstanceId: updated.workflowInstanceId,
      taskId: updated.id,
      taskName: updated.name,
      taskType: updated.type,
      error: errorMessage,
      timestamp: new Date(),
    });

    return updated;
  }

  async cancelTask(id: string): Promise<WorkflowTask> {
    const updated = await this.repository.updateStatus(id, TaskStatus.CANCELLED);
    if (!updated) {
      throw new Error(`Failed to cancel task ${id}`);
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.TASK_CANCELLED,
      workflowInstanceId: updated.workflowInstanceId,
      taskId: updated.id,
      taskName: updated.name,
      taskType: updated.type,
      timestamp: new Date(),
    });

    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error(`Failed to delete task ${id}`);
    }
  }

  async getTaskStatusCounts(workflowInstanceId: string): Promise<Record<string, number>> {
    return await this.repository.countByStatus(workflowInstanceId);
  }
}
