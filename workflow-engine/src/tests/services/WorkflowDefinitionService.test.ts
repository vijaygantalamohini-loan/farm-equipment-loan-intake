import { WorkflowDefinitionService } from '../../services/WorkflowDefinitionService';
import { WorkflowType } from '../../entities/WorkflowDefinition';

describe('WorkflowDefinitionService', () => {
  let service: WorkflowDefinitionService;

  beforeEach(() => {
    service = new WorkflowDefinitionService();
  });

  describe('validateWorkflowConfig', () => {
    it('should validate a valid workflow configuration', () => {
      const config = {
        initialState: 'start',
        finalStates: ['completed'],
        errorStates: ['failed'],
        states: [
          {
            name: 'start',
            type: 'initial' as const,
            allowedTransitions: ['processing'],
          },
          {
            name: 'processing',
            type: 'intermediate' as const,
            allowedTransitions: ['completed', 'failed'],
          },
          {
            name: 'completed',
            type: 'final' as const,
            allowedTransitions: [],
          },
          {
            name: 'failed',
            type: 'error' as const,
            allowedTransitions: [],
          },
        ],
      };

      expect(() => service.validateWorkflowConfig(config)).not.toThrow();
    });

    it('should throw error if no states defined', () => {
      const config = {
        initialState: 'start',
        finalStates: ['completed'],
        errorStates: [],
        states: [],
      };

      expect(() => service.validateWorkflowConfig(config)).toThrow(
        'Workflow must have at least one state'
      );
    });

    it('should throw error if initial state not found', () => {
      const config = {
        initialState: 'nonexistent',
        finalStates: ['completed'],
        errorStates: [],
        states: [
          {
            name: 'start',
            type: 'initial' as const,
            allowedTransitions: [],
          },
        ],
      };

      expect(() => service.validateWorkflowConfig(config)).toThrow(
        "Initial state 'nonexistent' not found in states"
      );
    });

    it('should throw error for invalid transition', () => {
      const config = {
        initialState: 'start',
        finalStates: ['completed'],
        errorStates: [],
        states: [
          {
            name: 'start',
            type: 'initial' as const,
            allowedTransitions: ['nonexistent'],
          },
          {
            name: 'completed',
            type: 'final' as const,
            allowedTransitions: [],
          },
        ],
      };

      expect(() => service.validateWorkflowConfig(config)).toThrow(
        "State 'start' has invalid transition to 'nonexistent'"
      );
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transition', () => {
      const config = {
        initialState: 'start',
        finalStates: ['completed'],
        errorStates: [],
        states: [
          {
            name: 'start',
            type: 'initial' as const,
            allowedTransitions: ['processing'],
          },
          {
            name: 'processing',
            type: 'intermediate' as const,
            allowedTransitions: ['completed'],
          },
          {
            name: 'completed',
            type: 'final' as const,
            allowedTransitions: [],
          },
        ],
      };

      expect(service.isValidTransition(config, 'start', 'processing')).toBe(true);
    });

    it('should return false for invalid transition', () => {
      const config = {
        initialState: 'start',
        finalStates: ['completed'],
        errorStates: [],
        states: [
          {
            name: 'start',
            type: 'initial' as const,
            allowedTransitions: ['processing'],
          },
          {
            name: 'processing',
            type: 'intermediate' as const,
            allowedTransitions: ['completed'],
          },
          {
            name: 'completed',
            type: 'final' as const,
            allowedTransitions: [],
          },
        ],
      };

      expect(service.isValidTransition(config, 'start', 'completed')).toBe(false);
    });
  });
});
