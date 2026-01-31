import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateWorkflowTables1706745600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create workflow_definitions table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_definitions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'version',
            type: 'varchar',
            length: '50',
          },
          {
            name: 'config',
            type: 'jsonb',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create workflow_instances table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_instances',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflow_definition_id',
            type: 'uuid',
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'entity_type',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'current_state',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'previous_state',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'failed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'max_retries',
            type: 'integer',
            default: 3,
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create workflow_transitions table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_transitions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflow_instance_id',
            type: 'uuid',
          },
          {
            name: 'from_state',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'to_state',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'success'",
          },
          {
            name: 'trigger',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'triggered_by',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'context',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'duration_ms',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create workflow_tasks table
    await queryRunner.createTable(
      new Table({
        name: 'workflow_tasks',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'workflow_instance_id',
            type: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'type',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'pending'",
          },
          {
            name: 'priority',
            type: 'varchar',
            length: '50',
            default: "'normal'",
          },
          {
            name: 'assigned_to',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'assigned_role',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'input',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'output',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'due_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'retry_count',
            type: 'integer',
            default: 0,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Add foreign keys
    await queryRunner.createForeignKey(
      'workflow_instances',
      new TableForeignKey({
        columnNames: ['workflow_definition_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workflow_definitions',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'workflow_transitions',
      new TableForeignKey({
        columnNames: ['workflow_instance_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workflow_instances',
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'workflow_tasks',
      new TableForeignKey({
        columnNames: ['workflow_instance_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'workflow_instances',
        onDelete: 'CASCADE',
      })
    );

    // Create indexes
    await queryRunner.query(
      `CREATE INDEX idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_workflow_instances_status ON workflow_instances(status)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_workflow_instances_tenant ON workflow_instances(tenant_id)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_workflow_transitions_instance ON workflow_transitions(workflow_instance_id, created_at)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_workflow_tasks_instance_status ON workflow_tasks(workflow_instance_id, status)`
    );
    await queryRunner.query(
      `CREATE INDEX idx_workflow_tasks_assigned ON workflow_tasks(assigned_to, status)`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('workflow_tasks', true);
    await queryRunner.dropTable('workflow_transitions', true);
    await queryRunner.dropTable('workflow_instances', true);
    await queryRunner.dropTable('workflow_definitions', true);
  }
}
