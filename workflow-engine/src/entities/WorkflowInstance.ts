import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { WorkflowDefinition } from './WorkflowDefinition';

export enum WorkflowStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SUSPENDED = 'suspended',
}

@Entity('workflow_instances')
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_definition_id', type: 'uuid' })
  workflowDefinitionId: string;

  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'workflow_definition_id' })
  workflowDefinition: WorkflowDefinition;

  @Column({ name: 'entity_id', type: 'varchar', length: 255 })
  entityId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 100 })
  entityType: string;

  @Column({ name: 'current_state', type: 'varchar', length: 100 })
  currentState: string;

  @Column({ name: 'previous_state', type: 'varchar', length: 100, nullable: true })
  previousState: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: WorkflowStatus;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  context: Record<string, any>;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failedAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ name: 'tenant_id', type: 'varchar', length: 255, nullable: true })
  tenantId: string;

  @Column({ name: 'created_by', type: 'varchar', length: 255, nullable: true })
  createdBy: string;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
