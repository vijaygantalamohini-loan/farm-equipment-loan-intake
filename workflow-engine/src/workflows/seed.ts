import { AppDataSource } from '../config/database';
import { WorkflowDefinitionService } from '../services/WorkflowDefinitionService';
import { WorkflowType } from '../entities/WorkflowDefinition';
import { LOAN_APPLICATION_WORKFLOW, UNDERWRITING_WORKFLOW } from './definitions';

export async function seedWorkflows(): Promise<void> {
  await AppDataSource.initialize();
  
  const service = new WorkflowDefinitionService();

  try {
    const loanWorkflow = await service.createDefinition({
      name: 'loan_application',
      type: 'loan_application' as any,
      version: '1.0.0',
      config: LOAN_APPLICATION_WORKFLOW,
      description: 'Complete loan application workflow from draft to funding',
    });
    console.log('Created loan application workflow:', loanWorkflow.id);

    const underwritingWorkflow = await service.createDefinition({
      name: 'underwriting',
      type: 'underwriting' as any,
      version: '1.0.0',
      config: UNDERWRITING_WORKFLOW,
      description: 'Underwriting process workflow',
    });
    console.log('Created underwriting workflow:', underwritingWorkflow.id);

  } catch (error) {
    console.error('Error seeding workflows:', error);
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  seedWorkflows()
    .then(() => {
      console.log('Workflow seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Workflow seeding failed:', error);
      process.exit(1);
    });
}
