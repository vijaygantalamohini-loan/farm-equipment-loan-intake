import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { WorkflowInstance } from './WorkflowInstance';

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped',
}

export enum TaskPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('workflow_tasks')
@Index(['workflowInstanceId', 'status'])
@Index(['assignedTo', 'status'])
export class WorkflowTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_instance_id', type: 'uuid' })
  workflowInstanceId: string;

  @ManyToOne(() => WorkflowInstance)
  @JoinColumn({ name: 'workflow_instance_id' })
  workflowInstance: WorkflowInstance;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50, default: 'pending' })
  status: TaskStatus;

  @Column({ type: 'varchar', length: 50, default: 'normal' })
  priority: TaskPriority;

  @Column({ name: 'assigned_to', type: 'varchar', length: 255, nullable: true })
  assignedTo: string;

  @Column({ name: 'assigned_role', type: 'varchar', length: 100, nullable: true })
  assignedRole: string;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  input: Record<string, any>;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  output: Record<string, any>;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate: Date;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
