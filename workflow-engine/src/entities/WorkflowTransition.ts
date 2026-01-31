import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { WorkflowInstance } from './WorkflowInstance';

export enum TransitionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

@Entity('workflow_transitions')
@Index(['workflowInstanceId', 'createdAt'])
export class WorkflowTransition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workflow_instance_id', type: 'uuid' })
  workflowInstanceId: string;

  @ManyToOne(() => WorkflowInstance)
  @JoinColumn({ name: 'workflow_instance_id' })
  workflowInstance: WorkflowInstance;

  @Column({ name: 'from_state', type: 'varchar', length: 100 })
  fromState: string;

  @Column({ name: 'to_state', type: 'varchar', length: 100 })
  toState: string;

  @Column({ type: 'varchar', length: 50, default: 'success' })
  status: TransitionStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  trigger: string;

  @Column({ name: 'triggered_by', type: 'varchar', length: 255, nullable: true })
  triggeredBy: string;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  context: Record<string, any>;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs: number;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
