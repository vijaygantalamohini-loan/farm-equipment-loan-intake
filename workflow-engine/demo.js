#!/usr/bin/env node

/**
 * Workflow Engine Quick Start Script
 * 
 * This script demonstrates the complete workflow engine functionality:
 * 1. Start the engine
 * 2. Create workflow definitions
 * 3. Create workflow instances
 * 4. Perform state transitions
 * 5. Create and manage tasks
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3005/api';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createLoanApplicationWorkflow() {
  console.log('\n📋 Creating Loan Application Workflow Definition...');
  
  const response = await axios.post(`${BASE_URL}/workflow-definitions`, {
    name: 'loan_application',
    type: 'loan_application',
    version: '1.0.0',
    description: 'Complete loan application workflow from draft to funding',
    config: {
      initialState: 'draft',
      finalStates: ['funded', 'closed'],
      errorStates: ['rejected', 'cancelled'],
      states: [
        {
          name: 'draft',
          type: 'initial',
          allowedTransitions: ['submitted', 'cancelled'],
        },
        {
          name: 'submitted',
          type: 'intermediate',
          allowedTransitions: ['under_review', 'cancelled'],
        },
        {
          name: 'under_review',
          type: 'intermediate',
          allowedTransitions: ['approved', 'rejected'],
        },
        {
          name: 'approved',
          type: 'intermediate',
          allowedTransitions: ['funded'],
        },
        {
          name: 'funded',
          type: 'final',
          allowedTransitions: ['closed'],
        },
        {
          name: 'closed',
          type: 'final',
          allowedTransitions: [],
        },
        {
          name: 'rejected',
          type: 'error',
          allowedTransitions: [],
        },
        {
          name: 'cancelled',
          type: 'error',
          allowedTransitions: [],
        },
      ],
    },
  });
  
  console.log('✅ Workflow Definition Created:', response.data.id);
  return response.data;
}

async function createWorkflowInstance(workflowDefinitionId, applicationId) {
  console.log('\n🔄 Creating Workflow Instance for Application:', applicationId);
  
  const response = await axios.post(`${BASE_URL}/workflow-instances`, {
    workflowDefinitionId,
    entityId: applicationId,
    entityType: 'loan_application',
    context: {
      loanAmount: 50000,
      equipmentType: 'tractor',
      dealerName: 'Farm Equipment Plus',
    },
    tenantId: 'demo-tenant',
    createdBy: 'demo-user',
  });
  
  console.log('✅ Workflow Instance Created:', response.data.id);
  console.log('   Current State:', response.data.currentState);
  return response.data;
}

async function transitionState(instanceId, toState, trigger) {
  console.log(`\n➡️  Transitioning to: ${toState}`);
  
  const response = await axios.post(`${BASE_URL}/workflow-instances/${instanceId}/transition`, {
    toState,
    trigger,
    triggeredBy: 'demo-user',
    context: {
      timestamp: new Date().toISOString(),
    },
  });
  
  console.log('✅ Transition Complete');
  console.log('   From:', response.data.previousState);
  console.log('   To:', response.data.currentState);
  console.log('   Status:', response.data.status);
  return response.data;
}

async function createTask(instanceId, taskName, taskType) {
  console.log(`\n📝 Creating Task: ${taskName}`);
  
  const response = await axios.post(`${BASE_URL}/workflow-tasks`, {
    workflowInstanceId: instanceId,
    name: taskName,
    type: taskType,
    priority: 'normal',
    assignedTo: 'underwriter-1',
    description: `Task created for ${taskName}`,
    input: {
      workflowInstanceId: instanceId,
    },
  });
  
  console.log('✅ Task Created:', response.data.id);
  return response.data;
}

async function completeTask(taskId) {
  console.log(`\n✓ Completing Task: ${taskId}`);
  
  await axios.post(`${BASE_URL}/workflow-tasks/${taskId}/start`);
  await wait(1000);
  
  const response = await axios.post(`${BASE_URL}/workflow-tasks/${taskId}/complete`, {
    output: {
      result: 'success',
      completedAt: new Date().toISOString(),
    },
  });
  
  console.log('✅ Task Completed');
  return response.data;
}

async function getWorkflowHistory(instanceId) {
  console.log('\n📜 Fetching Workflow History...');
  
  const response = await axios.get(`${BASE_URL}/workflow-instances/${instanceId}/history`);
  
  console.log(`\n✅ Found ${response.data.items.length} transitions:`);
  response.data.items.forEach((transition, index) => {
    console.log(`   ${index + 1}. ${transition.fromState} → ${transition.toState}`);
    console.log(`      Status: ${transition.status}`);
    console.log(`      Time: ${new Date(transition.createdAt).toLocaleString()}`);
  });
  
  return response.data;
}

async function main() {
  try {
    console.log('🚀 Workflow Engine Demo Starting...\n');
    console.log('Make sure the workflow engine is running on http://localhost:3005\n');
    
    await wait(2000);
    
    // Step 1: Create workflow definition
    const workflowDef = await createLoanApplicationWorkflow();
    await wait(1000);
    
    // Step 2: Create workflow instance
    const applicationId = `app-${Date.now()}`;
    const instance = await createWorkflowInstance(workflowDef.id, applicationId);
    await wait(1000);
    
    // Step 3: Transition through states
    await transitionState(instance.id, 'submitted', 'user_submitted');
    await wait(1000);
    
    // Step 4: Create review task
    const reviewTask = await createTask(instance.id, 'Review Application', 'review');
    await wait(1000);
    
    // Step 5: Complete review task
    await completeTask(reviewTask.id);
    await wait(1000);
    
    // Step 6: Continue transitions
    await transitionState(instance.id, 'under_review', 'auto_transition');
    await wait(1000);
    
    await transitionState(instance.id, 'approved', 'underwriter_approved');
    await wait(1000);
    
    await transitionState(instance.id, 'funded', 'payment_completed');
    await wait(1000);
    
    // Step 7: Get workflow history
    await getWorkflowHistory(instance.id);
    
    console.log('\n\n✨ Demo Complete!');
    console.log('\n📊 Summary:');
    console.log(`   Application ID: ${applicationId}`);
    console.log(`   Workflow Instance: ${instance.id}`);
    console.log(`   Final State: funded`);
    console.log(`   Tasks Created: 1`);
    console.log(`   Transitions: 5`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    console.error('\nMake sure:');
    console.error('  1. Workflow engine is running (npm run dev)');
    console.error('  2. PostgreSQL is running');
    console.error('  3. Redis is running');
    process.exit(1);
  }
}

if (require.main === module) {
  main().then(() => process.exit(0));
}

module.exports = { main };
