import { WorkflowInstanceRepository, WorkflowInstanceFilters } from '../repositories/WorkflowInstanceRepository';
import { WorkflowTransitionRepository } from '../repositories/WorkflowTransitionRepository';
import { WorkflowDefinitionService } from './WorkflowDefinitionService';
import { WorkflowInstance, WorkflowStatus } from '../entities/WorkflowInstance';
import { WorkflowTransition, TransitionStatus } from '../entities/WorkflowTransition';
import { CreateWorkflowInstanceDto, TransitionWorkflowDto, UpdateWorkflowContextDto, PaginatedResponse } from '../dtos/workflow.dto';
import { EventEmitter } from '../events/EventEmitter';
import { WorkflowEventType } from '../events/types';

export class WorkflowInstanceService {
  private instanceRepository: WorkflowInstanceRepository;
  private transitionRepository: WorkflowTransitionRepository;
  private definitionService: WorkflowDefinitionService;
  private eventEmitter: EventEmitter;

  constructor() {
    this.instanceRepository = new WorkflowInstanceRepository();
    this.transitionRepository = new WorkflowTransitionRepository();
    this.definitionService = new WorkflowDefinitionService();
    this.eventEmitter = EventEmitter.getInstance();
  }

  async createInstance(dto: CreateWorkflowInstanceDto): Promise<WorkflowInstance> {
    const definition = await this.definitionService.getDefinitionById(dto.workflowDefinitionId);

    const instance = await this.instanceRepository.create({
      workflowDefinitionId: definition.id,
      entityId: dto.entityId,
      entityType: dto.entityType,
      currentState: definition.config.initialState,
      status: WorkflowStatus.PENDING,
      context: dto.context || {},
      tenantId: dto.tenantId,
      createdBy: dto.createdBy,
      metadata: dto.metadata,
    });

    await this.eventEmitter.emit({
      type: WorkflowEventType.WORKFLOW_CREATED,
      workflowInstanceId: instance.id,
      entityId: instance.entityId,
      entityType: instance.entityType,
      currentState: instance.currentState,
      context: instance.context,
      timestamp: new Date(),
    });

    return instance;
  }

  async getInstanceById(id: string): Promise<WorkflowInstance> {
    const instance = await this.instanceRepository.findById(id);
    if (!instance) {
      throw new Error(`Workflow instance with id ${id} not found`);
    }
    return instance;
  }

  async getInstancesByEntity(entityId: string, entityType: string): Promise<WorkflowInstance[]> {
    return await this.instanceRepository.findByEntityId(entityId, entityType);
  }

  async getInstances(
    filters: WorkflowInstanceFilters,
    page: number = 1,
    pageSize: number = 25,
    sortBy: string = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): Promise<PaginatedResponse<WorkflowInstance>> {
    const { items, total } = await this.instanceRepository.findAll(
      filters,
      page,
      pageSize,
      sortBy,
      sortOrder
    );

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async transition(id: string, dto: TransitionWorkflowDto): Promise<WorkflowInstance> {
    const startTime = Date.now();
    const instance = await this.getInstanceById(id);
    const definition = instance.workflowDefinition;

    // Validate transition
    if (!this.definitionService.isValidTransition(definition.config, instance.currentState, dto.toState)) {
      throw new Error(
        `Invalid transition from '${instance.currentState}' to '${dto.toState}'`
      );
    }

    const fromState = instance.currentState;
    const toState = dto.toState;

    try {
      // Execute onExit actions for current state
      await this.executeStateActions(instance, fromState, 'onExit');

      // Update instance state
      const updatedInstance = await this.instanceRepository.updateState(id, toState, fromState);
      if (!updatedInstance) {
        throw new Error('Failed to update instance state');
      }

      // Update status based on new state
      const newStatus = this.determineStatus(definition.config, toState);
      if (newStatus !== updatedInstance.status) {
        await this.instanceRepository.updateStatus(id, newStatus);
      }

      // Merge context if provided
      if (dto.context) {
        await this.instanceRepository.updateContext(id, dto.context, true);
      }

      // Record transition
      const durationMs = Date.now() - startTime;
      await this.transitionRepository.create({
        workflowInstanceId: id,
        fromState,
        toState,
        status: TransitionStatus.SUCCESS,
        trigger: dto.trigger,
        triggeredBy: dto.triggeredBy,
        context: dto.context,
        durationMs,
        metadata: dto.metadata,
      });

      // Execute onEnter actions for new state
      await this.executeStateActions(updatedInstance, toState, 'onEnter');

      // Emit event
      await this.eventEmitter.emit({
        type: WorkflowEventType.STATE_CHANGED,
        workflowInstanceId: id,
        entityId: updatedInstance.entityId,
        entityType: updatedInstance.entityType,
        previousState: fromState,
        currentState: toState,
        context: updatedInstance.context,
        triggeredBy: dto.triggeredBy,
        timestamp: new Date(),
      });

      return await this.getInstanceById(id);
    } catch (error) {
      // Record failed transition
      const durationMs = Date.now() - startTime;
      await this.transitionRepository.create({
        workflowInstanceId: id,
        fromState,
        toState,
        status: TransitionStatus.FAILED,
        trigger: dto.trigger,
        triggeredBy: dto.triggeredBy,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
        metadata: dto.metadata,
      });

      throw error;
    }
  }

  async updateContext(id: string, dto: UpdateWorkflowContextDto): Promise<WorkflowInstance> {
    await this.instanceRepository.updateContext(id, dto.context, dto.merge);
    return await this.getInstanceById(id);
  }

  async startInstance(id: string): Promise<WorkflowInstance> {
    const updated = await this.instanceRepository.updateStatus(id, WorkflowStatus.ACTIVE);
    if (!updated) {
      throw new Error('Failed to start instance');
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.WORKFLOW_STARTED,
      workflowInstanceId: id,
      entityId: updated.entityId,
      entityType: updated.entityType,
      currentState: updated.currentState,
      context: updated.context,
      timestamp: new Date(),
    });

    return updated;
  }

  async completeInstance(id: string): Promise<WorkflowInstance> {
    const updated = await this.instanceRepository.updateStatus(id, WorkflowStatus.COMPLETED);
    if (!updated) {
      throw new Error('Failed to complete instance');
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.WORKFLOW_COMPLETED,
      workflowInstanceId: id,
      entityId: updated.entityId,
      entityType: updated.entityType,
      currentState: updated.currentState,
      context: updated.context,
      timestamp: new Date(),
    });

    return updated;
  }

  async failInstance(id: string, errorMessage: string): Promise<WorkflowInstance> {
    const instance = await this.getInstanceById(id);

    const updated = await this.instanceRepository.update(id, {
      status: WorkflowStatus.FAILED,
      errorMessage,
      failedAt: new Date(),
    });

    if (!updated) {
      throw new Error('Failed to update instance');
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.WORKFLOW_FAILED,
      workflowInstanceId: id,
      entityId: updated.entityId,
      entityType: updated.entityType,
      currentState: updated.currentState,
      error: errorMessage,
      context: updated.context,
      timestamp: new Date(),
    });

    return updated;
  }

  async cancelInstance(id: string): Promise<WorkflowInstance> {
    const updated = await this.instanceRepository.updateStatus(id, WorkflowStatus.CANCELLED);
    if (!updated) {
      throw new Error('Failed to cancel instance');
    }

    await this.eventEmitter.emit({
      type: WorkflowEventType.WORKFLOW_CANCELLED,
      workflowInstanceId: id,
      entityId: updated.entityId,
      entityType: updated.entityType,
      currentState: updated.currentState,
      context: updated.context,
      timestamp: new Date(),
    });

    return updated;
  }

  async getTransitionHistory(id: string, page: number = 1, pageSize: number = 25): Promise<PaginatedResponse<WorkflowTransition>> {
    const { items, total } = await this.transitionRepository.findByWorkflowInstance(id, page, pageSize);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getActiveInstancesByEntityType(entityType: string): Promise<WorkflowInstance[]> {
    return await this.instanceRepository.findActiveByEntityType(entityType);
  }

  async deleteInstance(id: string): Promise<void> {
    const deleted = await this.instanceRepository.delete(id);
    if (!deleted) {
      throw new Error(`Failed to delete workflow instance ${id}`);
    }
  }

  private determineStatus(config: any, state: string): WorkflowStatus {
    if (this.definitionService.isFinalState(config, state)) {
      return WorkflowStatus.COMPLETED;
    }
    if (this.definitionService.isErrorState(config, state)) {
      return WorkflowStatus.FAILED;
    }
    return WorkflowStatus.ACTIVE;
  }

  private async executeStateActions(
    instance: WorkflowInstance,
    state: string,
    hook: 'onEnter' | 'onExit'
  ): Promise<void> {
    const stateDefinition = this.definitionService.getStateDefinition(
      instance.workflowDefinition.config,
      state
    );

    if (!stateDefinition?.actions?.[hook]) {
      return;
    }

    const actions = stateDefinition.actions[hook] || [];
    for (const action of actions) {
      try {
        await this.eventEmitter.emit({
          type: WorkflowEventType.ACTION_TRIGGERED,
          workflowInstanceId: instance.id,
          entityId: instance.entityId,
          entityType: instance.entityType,
          currentState: state,
          action,
          hook,
          context: instance.context,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(`Failed to execute action ${action} on ${hook} for state ${state}:`, error);
      }
    }
  }
}
