import { z } from 'zod';

// Workflow Definition DTOs
export const CreateWorkflowDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['loan_application', 'underwriting', 'decision', 'funding']),
  version: z.string(),
  config: z.object({
    states: z.array(z.object({
      name: z.string(),
      type: z.enum(['initial', 'intermediate', 'final', 'error']),
      allowedTransitions: z.array(z.string()),
      requiredFields: z.array(z.string()).optional(),
      validations: z.record(z.any()).optional(),
      actions: z.object({
        onEnter: z.array(z.string()).optional(),
        onExit: z.array(z.string()).optional(),
      }).optional(),
      timeout: z.number().optional(),
      metadata: z.record(z.any()).optional(),
    })),
    initialState: z.string(),
    finalStates: z.array(z.string()),
    errorStates: z.array(z.string()),
  }),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateWorkflowDefinitionDto = z.infer<typeof CreateWorkflowDefinitionSchema>;

// Workflow Instance DTOs
export const CreateWorkflowInstanceSchema = z.object({
  workflowDefinitionId: z.string().uuid(),
  entityId: z.string(),
  entityType: z.string(),
  context: z.record(z.any()).optional(),
  tenantId: z.string().optional(),
  createdBy: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateWorkflowInstanceDto = z.infer<typeof CreateWorkflowInstanceSchema>;

export const TransitionWorkflowSchema = z.object({
  toState: z.string(),
  trigger: z.string().optional(),
  triggeredBy: z.string().optional(),
  context: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type TransitionWorkflowDto = z.infer<typeof TransitionWorkflowSchema>;

export const UpdateWorkflowContextSchema = z.object({
  context: z.record(z.any()),
  merge: z.boolean().default(true),
});

export type UpdateWorkflowContextDto = z.infer<typeof UpdateWorkflowContextSchema>;

// Workflow Task DTOs
export const CreateWorkflowTaskSchema = z.object({
  workflowInstanceId: z.string().uuid(),
  name: z.string().min(1).max(100),
  type: z.string(),
  description: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  assignedTo: z.string().optional(),
  assignedRole: z.string().optional(),
  input: z.record(z.any()).optional(),
  dueDate: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateWorkflowTaskDto = z.infer<typeof CreateWorkflowTaskSchema>;

export const UpdateWorkflowTaskSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled', 'skipped']).optional(),
  output: z.record(z.any()).optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateWorkflowTaskDto = z.infer<typeof UpdateWorkflowTaskSchema>;

// Query DTOs
export const WorkflowQuerySchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(25),
  status: z.enum(['pending', 'active', 'completed', 'failed', 'cancelled', 'suspended']).optional(),
  entityType: z.string().optional(),
  tenantId: z.string().optional(),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type WorkflowQueryDto = z.infer<typeof WorkflowQuerySchema>;

// Response DTOs
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface WorkflowInstanceResponse {
  id: string;
  workflowDefinitionId: string;
  entityId: string;
  entityType: string;
  currentState: string;
  previousState: string | null;
  status: string;
  context: Record<string, any>;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  errorMessage: string | null;
  retryCount: number;
  tenantId: string | null;
  createdBy: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTransitionResponse {
  id: string;
  workflowInstanceId: string;
  fromState: string;
  toState: string;
  status: string;
  trigger: string | null;
  triggeredBy: string | null;
  context: Record<string, any>;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
}
