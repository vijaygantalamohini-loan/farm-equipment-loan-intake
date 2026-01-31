# Workflow Engine Integration Guide

## Integration with Loan Intake Backend

### Step 1: Add Workflow Client to Python Backend

Create `loan-intake-backend/services/workflow_client.py`:

```python
import httpx
from typing import Dict, Any, Optional

class WorkflowClient:
    def __init__(self, base_url: str = "http://localhost:3005"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url)
    
    async def create_workflow_instance(
        self,
        workflow_definition_id: str,
        entity_id: str,
        entity_type: str,
        context: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        response = await self.client.post(
            "/api/workflow-instances",
            json={
                "workflowDefinitionId": workflow_definition_id,
                "entityId": entity_id,
                "entityType": entity_type,
                "context": context or {},
                "tenantId": tenant_id,
                "createdBy": created_by,
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def transition_workflow(
        self,
        instance_id: str,
        to_state: str,
        trigger: Optional[str] = None,
        triggered_by: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        response = await self.client.post(
            f"/api/workflow-instances/{instance_id}/transition",
            json={
                "toState": to_state,
                "trigger": trigger,
                "triggeredBy": triggered_by,
                "context": context,
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def get_workflow_instance(self, instance_id: str) -> Dict[str, Any]:
        response = await self.client.get(f"/api/workflow-instances/{instance_id}")
        response.raise_for_status()
        return response.json()
    
    async def get_workflow_by_entity(
        self, entity_id: str, entity_type: str
    ) -> list[Dict[str, Any]]:
        response = await self.client.get(
            f"/api/workflow-instances/entity/{entity_type}/{entity_id}"
        )
        response.raise_for_status()
        return response.json()
```

### Step 2: Update Application Submission

In `loan-intake-backend/routers/loan_routes.py`:

```python
from services.workflow_client import WorkflowClient

workflow_client = WorkflowClient()

@router.post("/loans/submit")
async def submit_application(data: dict, current_user: dict = Depends(get_current_user)):
    # Create application
    application = create_loan_application(data)
    
    # Create workflow instance
    workflow = await workflow_client.create_workflow_instance(
        workflow_definition_id="<loan_application_workflow_id>",
        entity_id=str(application.id),
        entity_type="loan_application",
        context={"application_data": data},
        tenant_id=current_user.get("tenant_id"),
        created_by=current_user.get("user_id"),
    )
    
    # Transition to submitted state
    await workflow_client.transition_workflow(
        instance_id=workflow["id"],
        to_state="submitted",
        trigger="user_submit",
        triggered_by=current_user.get("user_id"),
    )
    
    return {"application": application, "workflow": workflow}
```

### Step 3: Add Webhook Endpoint

In `loan-intake-backend/routers/loan_routes.py`:

```python
@router.post("/loans/webhooks/workflow")
async def workflow_webhook(data: dict):
    event_type = data.get("eventType")
    workflow_instance_id = data.get("workflowInstanceId")
    event_data = data.get("data", {})
    
    if event_type == "decision.ready":
        # Update application with decision
        entity_id = event_data.get("entityId")
        application = get_application_by_id(entity_id)
        application.status = "decision_ready"
        save_application(application)
    
    elif event_type == "application.approved":
        # Send approval notifications
        send_approval_notifications(event_data)
    
    return {"status": "received"}
```

### Step 4: Environment Variables

Add to `loan-intake-backend/.env`:

```env
WORKFLOW_ENGINE_URL=http://localhost:3005
```

## Frontend Integration

### Step 1: Add Workflow API Client

Create `loan-intake-frontend/src/services/workflowApi.js`:

```javascript
export const workflowAPI = {
  async getWorkflowInstance(instanceId) {
    const response = await fetch(`http://localhost:3005/api/workflow-instances/${instanceId}`);
    return response.json();
  },
  
  async getWorkflowByEntity(entityType, entityId) {
    const response = await fetch(
      `http://localhost:3005/api/workflow-instances/entity/${entityType}/${entityId}`
    );
    return response.json();
  },
  
  async getWorkflowHistory(instanceId) {
    const response = await fetch(
      `http://localhost:3005/api/workflow-instances/${instanceId}/history`
    );
    return response.json();
  },
  
  async transitionWorkflow(instanceId, toState, context = {}) {
    const response = await fetch(
      `http://localhost:3005/api/workflow-instances/${instanceId}/transition`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toState, context }),
      }
    );
    return response.json();
  },
};
```

### Step 2: Add Workflow Status Component

Create `loan-intake-frontend/src/components/WorkflowStatus.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { workflowAPI } from '../services/workflowApi';

export function WorkflowStatus({ applicationId }) {
  const [workflow, setWorkflow] = useState(null);
  const [history, setHistory] = useState([]);
  
  useEffect(() => {
    loadWorkflow();
  }, [applicationId]);
  
  async function loadWorkflow() {
    const workflows = await workflowAPI.getWorkflowByEntity('loan_application', applicationId);
    if (workflows.length > 0) {
      setWorkflow(workflows[0]);
      const historyData = await workflowAPI.getWorkflowHistory(workflows[0].id);
      setHistory(historyData.items);
    }
  }
  
  return (
    <div className="workflow-status">
      <h3>Application Status</h3>
      {workflow && (
        <>
          <div className="current-state">
            <strong>Current State:</strong> {workflow.currentState}
          </div>
          <div className="workflow-history">
            <h4>History</h4>
            {history.map(transition => (
              <div key={transition.id}>
                {transition.fromState} → {transition.toState}
                <span>{new Date(transition.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

## Running the Workflow Engine

### Development

```bash
cd workflow-engine
npm install
npm run dev
```

### Production

```bash
cd workflow-engine
npm install
npm run build
npm start
```

### With Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

## Testing

```bash
# Create workflow instance
curl -X POST http://localhost:3005/api/workflow-instances \
  -H "Content-Type: application/json" \
  -d '{
    "workflowDefinitionId": "<workflow_id>",
    "entityId": "app-123",
    "entityType": "loan_application",
    "context": {}
  }'

# Transition state
curl -X POST http://localhost:3005/api/workflow-instances/<instance_id>/transition \
  -H "Content-Type: application/json" \
  -d '{
    "toState": "submitted",
    "trigger": "user_action"
  }'

# Get instance
curl http://localhost:3005/api/workflow-instances/<instance_id>

# Get history
curl http://localhost:3005/api/workflow-instances/<instance_id>/history
```
