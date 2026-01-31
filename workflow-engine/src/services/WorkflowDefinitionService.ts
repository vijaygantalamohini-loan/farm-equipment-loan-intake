import { WorkflowDefinitionRepository } from '../repositories/WorkflowDefinitionRepository';
import { WorkflowDefinition, WorkflowType, StateDefinition, WorkflowConfig } from '../entities/WorkflowDefinition';
import { CreateWorkflowDefinitionDto } from '../dtos/workflow.dto';

export class WorkflowDefinitionService {
  private repository: WorkflowDefinitionRepository;

  constructor() {
    this.repository = new WorkflowDefinitionRepository();
  }

  async createDefinition(dto: CreateWorkflowDefinitionDto): Promise<WorkflowDefinition> {
    this.validateWorkflowConfig(dto.config as any);

    const definition = await this.repository.create({
      name: dto.name,
      type: dto.type as WorkflowType,
      version: dto.version,
      config: dto.config as any,
      description: dto.description,
      metadata: dto.metadata,
      isActive: true,
    });

    return definition;
  }

  async getDefinitionById(id: string): Promise<WorkflowDefinition> {
    const definition = await this.repository.findById(id);
    if (!definition) {
      throw new Error(`Workflow definition with id ${id} not found`);
    }
    return definition;
  }

  async getDefinitionByName(name: string): Promise<WorkflowDefinition> {
    const definition = await this.repository.findByName(name);
    if (!definition) {
      throw new Error(`Active workflow definition with name ${name} not found`);
    }
    return definition;
  }

  async getDefinitionsByType(type: WorkflowType): Promise<WorkflowDefinition[]> {
    return await this.repository.findByType(type);
  }

  async getAllDefinitions(isActive?: boolean): Promise<WorkflowDefinition[]> {
    return await this.repository.findAll({ isActive });
  }

  async updateDefinition(
    id: string,
    updates: Partial<CreateWorkflowDefinitionDto>
  ): Promise<WorkflowDefinition> {
    const existing = await this.getDefinitionById(id);

    if (updates.config) {
      this.validateWorkflowConfig(updates.config as any);
    }

    const updated = await this.repository.update(id, {
      name: updates.name,
      type: updates.type as any,
      version: updates.version,
      description: updates.description,
      metadata: updates.metadata,
      config: updates.config as any,
    } as any);

    if (!updated) {
      throw new Error(`Failed to update workflow definition ${id}`);
    }

    return updated;
  }

  async deactivateDefinition(id: string): Promise<WorkflowDefinition> {
    const deactivated = await this.repository.deactivate(id);
    if (!deactivated) {
      throw new Error(`Failed to deactivate workflow definition ${id}`);
    }
    return deactivated;
  }

  async deleteDefinition(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new Error(`Failed to delete workflow definition ${id}`);
    }
  }

  async getLatestVersion(name: string): Promise<WorkflowDefinition> {
    const definition = await this.repository.getLatestVersion(name);
    if (!definition) {
      throw new Error(`No active versions found for workflow ${name}`);
    }
    return definition;
  }

  validateWorkflowConfig(config: WorkflowConfig): void {
    // Validate states
    if (!config.states || config.states.length === 0) {
      throw new Error('Workflow must have at least one state');
    }

    // Validate initial state exists
    const stateNames = config.states.map(s => s.name);
    if (!stateNames.includes(config.initialState)) {
      throw new Error(`Initial state '${config.initialState}' not found in states`);
    }

    // Validate final states exist
    for (const finalState of config.finalStates) {
      if (!stateNames.includes(finalState)) {
        throw new Error(`Final state '${finalState}' not found in states`);
      }
    }

    // Validate error states exist
    for (const errorState of config.errorStates) {
      if (!stateNames.includes(errorState)) {
        throw new Error(`Error state '${errorState}' not found in states`);
      }
    }

    // Validate state transitions
    for (const state of config.states) {
      for (const transition of state.allowedTransitions) {
        if (!stateNames.includes(transition)) {
          throw new Error(
            `State '${state.name}' has invalid transition to '${transition}'`
          );
        }
      }
    }

    // Validate at least one initial state
    const initialStates = config.states.filter(s => s.type === 'initial');
    if (initialStates.length === 0) {
      throw new Error('Workflow must have at least one initial state');
    }

    // Validate at least one final state
    const finalStateObjects = config.states.filter(s => s.type === 'final');
    if (finalStateObjects.length === 0) {
      throw new Error('Workflow must have at least one final state');
    }
  }

  getStateDefinition(config: WorkflowConfig, stateName: string): StateDefinition | null {
    return config.states.find(s => s.name === stateName) || null;
  }

  isValidTransition(config: WorkflowConfig, fromState: string, toState: string): boolean {
    const state = this.getStateDefinition(config, fromState);
    return state ? state.allowedTransitions.includes(toState) : false;
  }

  isFinalState(config: WorkflowConfig, stateName: string): boolean {
    return config.finalStates.includes(stateName);
  }

  isErrorState(config: WorkflowConfig, stateName: string): boolean {
    return config.errorStates.includes(stateName);
  }
}
