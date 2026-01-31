export enum WorkflowEventType {
  // Workflow Instance Events
  WORKFLOW_CREATED = 'workflow.created',
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  WORKFLOW_CANCELLED = 'workflow.cancelled',
  
  // State Transition Events
  STATE_CHANGED = 'workflow.state_changed',
  ACTION_TRIGGERED = 'workflow.action_triggered',
  
  // Task Events
  TASK_CREATED = 'task.created',
  TASK_STARTED = 'task.started',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_CANCELLED = 'task.cancelled',
  TASK_STATUS_CHANGED = 'task.status_changed',
  
  // Application Events (Domain-Specific)
  APPLICATION_SUBMITTED = 'application.submitted',
  APPLICATION_UPDATED = 'application.updated',
  APPLICATION_APPROVED = 'application.approved',
  APPLICATION_REJECTED = 'application.rejected',
  
  // Underwriting Events
  UNDERWRITING_REQUESTED = 'underwriting.requested',
  UNDERWRITING_STARTED = 'underwriting.started',
  UNDERWRITING_COMPLETED = 'underwriting.completed',
  UNDERWRITING_FAILED = 'underwriting.failed',
  
  // Decision Events
  DECISION_READY = 'decision.ready',
  DECISION_APPROVED = 'decision.approved',
  DECISION_REJECTED = 'decision.rejected',
  DECISION_CONDITIONAL = 'decision.conditional',
  
  // Payment Events
  PAYMENT_INITIATED = 'payment.initiated',
  PAYMENT_COMPLETED = 'payment.completed',
  PAYMENT_FAILED = 'payment.failed',
}

export interface WorkflowEvent {
  type: WorkflowEventType;
  workflowInstanceId: string;
  entityId: string;
  entityType: string;
  currentState: string;
  previousState?: string;
  context?: Record<string, any>;
  error?: string;
  triggeredBy?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TaskEvent {
  type: WorkflowEventType;
  workflowInstanceId: string;
  taskId: string;
  taskName: string;
  taskType: string;
  previousStatus?: string;
  currentStatus?: string;
  assignedTo?: string;
  output?: Record<string, any>;
  error?: string;
  timestamp: Date;
}

export interface ActionEvent {
  type: WorkflowEventType;
  workflowInstanceId: string;
  entityId: string;
  entityType: string;
  currentState: string;
  action: string;
  hook: 'onEnter' | 'onExit';
  context?: Record<string, any>;
  timestamp: Date;
}

export type WorkflowEventPayload = WorkflowEvent | TaskEvent | ActionEvent;

export interface EventHandler {
  handle(event: WorkflowEventPayload): Promise<void>;
}
