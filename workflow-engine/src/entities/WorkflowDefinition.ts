import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum WorkflowType {
  LOAN_APPLICATION = 'loan_application',
  UNDERWRITING = 'underwriting',
  DECISION = 'decision',
  FUNDING = 'funding',
}

export interface StateDefinition {
  name: string;
  type: 'initial' | 'intermediate' | 'final' | 'error';
  allowedTransitions: string[];
  requiredFields?: string[];
  validations?: Record<string, any>;
  actions?: {
    onEnter?: string[];
    onExit?: string[];
  };
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowConfig {
  states: StateDefinition[];
  initialState: string;
  finalStates: string[];
  errorStates: string[];
}

@Entity('workflow_definitions')
export class WorkflowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  type: WorkflowType;

  @Column({ type: 'varchar', length: 50 })
  version: string;

  @Column({ type: 'text', transformer: { from: (value) => JSON.parse(value), to: (value) => JSON.stringify(value) } })
  config: WorkflowConfig;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true, transformer: { from: (value) => value ? JSON.parse(value) : null, to: (value) => value ? JSON.stringify(value) : null } })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
