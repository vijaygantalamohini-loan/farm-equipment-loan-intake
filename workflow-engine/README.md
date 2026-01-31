# Workflow Engine

Production-grade workflow orchestration engine for farm equipment loan applications.

## Features

- **State Machine**: Configurable workflow definitions with state transitions
- **Event-Driven**: Emit events on state changes, task completion, and workflow lifecycle
- **Queue System**: BullMQ-powered async task execution with retry logic
- **Task Management**: Create, assign, and track workflow tasks
- **Audit Trail**: Complete history of all state transitions
- **Multi-Tenant**: Support for tenant-specific workflows
- **REST API**: Full CRUD operations on workflows, instances, and tasks

## Architecture

```
workflow-engine/
├── src/
│   ├── entities/          # TypeORM entities
│   ├── repositories/      # Data access layer
│   ├── services/          # Business logic
│   ├── controllers/       # REST endpoints
│   ├── dtos/             # Request/response validation
│   ├── events/           # Event system
│   ├── queue/            # BullMQ queue processors
│   ├── workflows/        # Workflow definitions
│   └── config/           # Configuration
```

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3005
DATABASE_URL=postgresql://user:password@localhost:5432/farm_equipment_loan_intake
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Usage

### Start Development Server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Start Production

```bash
npm start
```

### Run Tests

```bash
npm test
```

### Seed Workflows

```bash
npm run build && node dist/workflows/seed.js
```

## API Endpoints

### Workflow Definitions

- `POST /api/workflow-definitions` - Create workflow definition
- `GET /api/workflow-definitions` - List all definitions
- `GET /api/workflow-definitions/:id` - Get definition by ID
- `GET /api/workflow-definitions/name/:name` - Get definition by name
- `GET /api/workflow-definitions/type/:type` - Get definitions by type
- `PATCH /api/workflow-definitions/:id` - Update definition
- `POST /api/workflow-definitions/:id/deactivate` - Deactivate definition
- `DELETE /api/workflow-definitions/:id` - Delete definition

### Workflow Instances

- `POST /api/workflow-instances` - Create workflow instance
- `GET /api/workflow-instances` - List instances (with filters)
- `GET /api/workflow-instances/:id` - Get instance by ID
- `GET /api/workflow-instances/entity/:entityType/:entityId` - Get instances by entity
- `POST /api/workflow-instances/:id/transition` - Transition to new state
- `PATCH /api/workflow-instances/:id/context` - Update context
- `POST /api/workflow-instances/:id/start` - Start instance
- `POST /api/workflow-instances/:id/complete` - Complete instance
- `POST /api/workflow-instances/:id/fail` - Fail instance
- `POST /api/workflow-instances/:id/cancel` - Cancel instance
- `GET /api/workflow-instances/:id/history` - Get transition history
- `DELETE /api/workflow-instances/:id` - Delete instance

### Workflow Tasks

- `POST /api/workflow-tasks` - Create task
- `GET /api/workflow-tasks` - List tasks (with filters)
- `GET /api/workflow-tasks/:id` - Get task by ID
- `GET /api/workflow-tasks/pending` - Get pending tasks
- `GET /api/workflow-tasks/overdue` - Get overdue tasks
- `GET /api/workflow-tasks/workflow/:workflowInstanceId` - Get tasks by workflow
- `PATCH /api/workflow-tasks/:id` - Update task
- `POST /api/workflow-tasks/:id/start` - Start task
- `POST /api/workflow-tasks/:id/complete` - Complete task
- `POST /api/workflow-tasks/:id/fail` - Fail task
- `POST /api/workflow-tasks/:id/cancel` - Cancel task
- `DELETE /api/workflow-tasks/:id` - Delete task

## Workflow States

### Loan Application Workflow

```
draft → submitted → under_review → underwriting → decision_pending →
approved → documents_pending → documents_received → funding_pending →
funded → closed
```

Error states: `rejected`, `cancelled`

### Underwriting Workflow

```
pending → in_progress → credit_check → collateral_review →
risk_assessment → decision → completed
```

Error states: `failed`, `cancelled`

## Events

The engine emits the following events:

- `workflow.created`
- `workflow.started`
- `workflow.completed`
- `workflow.failed`
- `workflow.cancelled`
- `workflow.state_changed`
- `workflow.action_triggered`
- `task.created`
- `task.started`
- `task.completed`
- `task.failed`
- `task.cancelled`
- `application.submitted`
- `application.approved`
- `application.rejected`
- `underwriting.requested`
- `underwriting.completed`
- `decision.ready`
- `payment.initiated`
- `payment.completed`

## Integration

The workflow engine integrates with:

- Application Service (via webhooks)
- Underwriting Service (via webhooks)
- Notification Service (via queue)
- Email Service (via queue)

## License

MIT
