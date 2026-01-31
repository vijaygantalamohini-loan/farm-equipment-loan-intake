# Underwriting Service

Microservice for managing underwriting requests, status tracking, and decision workflows for loan applications.

## Features

- ✅ **Underwriting Request Management** - Create and track underwriting requests
- ✅ **Status Tracking** - Monitor requests through pending, in_review, approved, rejected, more_info_needed states
- ✅ **Decision Workflow** - Record approval/rejection decisions with terms and conditions
- ✅ **Activity Logging** - Track all status changes, notes, and decisions
- ✅ **Queue Processing** - Asynchronous processing with BullMQ or RabbitMQ
- ✅ **Multi-Lender Support** - Filter requests by lender
- ✅ **Pagination** - Paginated endpoints following platform contract

## Architecture

```
src/
├── controllers/       # Express request handlers
├── services/         # Business logic
├── repositories/     # Data access layer (JSON storage)
├── dtos/            # Data transfer objects with Zod validation
├── entities/        # Domain entities
├── queue/           # BullMQ/RabbitMQ queue implementation
├── events/          # Event handlers for lifecycle
└── routes.ts        # API routes
```

## API Endpoints

### Create Underwriting Request
```
POST /underwriting/requests
{
  "applicationId": "app-123",
  "lenderId": "lender-456",
  "borrowerData": {
    "firstName": "John",
    "lastName": "Doe",
    "creditScore": 720,
    "income": 75000,
    "employmentStatus": "employed"
  },
  "loanData": {
    "amount": 50000,
    "term": 60,
    "purpose": "equipment purchase"
  },
  "collateralData": {
    "equipmentType": "tractor",
    "equipmentValue": 60000,
    "year": 2023,
    "make": "John Deere",
    "model": "5075E"
  }
}
```

### Get Request by ID
```
GET /underwriting/requests/:id
```

### Get by Application ID
```
GET /underwriting/by-application/:applicationId
```

### Update Status
```
PATCH /underwriting/requests/:id/status
{
  "status": "approved",
  "notes": "Credit score meets criteria",
  "decision": {
    "approved": true,
    "approvedAmount": 50000,
    "interestRate": 5.5,
    "term": 60,
    "conditions": ["Proof of insurance required"],
    "reason": "Strong credit profile"
  }
}
```

### Add Note
```
POST /underwriting/requests/:id/notes
{
  "note": "Requested additional income documentation",
  "performedBy": "underwriter-123"
}
```

### Get All Requests (Admin)
```
GET /underwriting/requests?page=1&page_size=25
```

### Get by Lender
```
GET /underwriting/by-lender/:lenderId?page=1&page_size=25
```

### Get by Status
```
GET /underwriting/by-status/:status?page=1&page_size=25
```

Status values: `pending`, `in_review`, `approved`, `rejected`, `more_info_needed`

### Get Activities
```
GET /underwriting/requests/:id/activities
```

## Installation

```bash
cd underwriting-service
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
UNDERWRITING_SERVICE_PORT=7002
QUEUE_PROVIDER=bullmq
REDIS_URL=redis://localhost:6379
UNDERWRITING_QUEUE_NAME=underwriting-jobs
```

## Running

Development:
```bash
npm run dev
```

Production:
```bash
npm run build
npm start
```

## Queue Processing

The service uses BullMQ (Redis) or RabbitMQ for asynchronous job processing:

- **Process Request** - Automatic review initiation
- **Retry Logic** - 3 attempts with exponential backoff
- **Dead Letter Queue** - Failed jobs after max retries

## Event Handlers

Located in `src/events/`:

1. **application-submitted.handler.ts** - Creates underwriting request when application submitted
2. **underwriting-completed.handler.ts** - Updates status when underwriting completed
3. **info-requested.handler.ts** - Handles additional information requests

## Storage

JSON file-based storage at `storage/underwriting.json`:

```json
{
  "requests": [...],
  "activities": [...]
}
```

## Integration

### Backend Gateway (FastAPI)

The backend automatically proxies to this service via `/underwriting/*` routes.

Environment variable:
```env
UNDERWRITING_SERVICE_URL=http://localhost:7002
```

### Frontend (React)

Use the `underwritingAPI` client from `services/api.js`:

```javascript
import { underwritingAPI } from '../services/api';

// Create request
await underwritingAPI.createRequest({
  applicationId: 'app-123',
  lenderId: 'lender-456',
  borrowerData: {...},
  loanData: {...}
});

// Get by application
const request = await underwritingAPI.getByApplicationId('app-123');

// Update status
await underwritingAPI.updateStatus('req-789', {
  status: 'approved',
  decision: {...}
});
```

## Pagination Contract

All paginated endpoints return:
```json
{
  "items": [...],
  "page": 1,
  "pageSize": 25,
  "total": 100,
  "totalPages": 4
}
```

## Status Workflow

```
pending → in_review → approved/rejected
                    ↓
              more_info_needed → in_review
```

## Production Considerations

1. **Queue Provider**: Choose Redis (BullMQ) for simpler setup or RabbitMQ for enterprise
2. **Database**: Replace JSON storage with PostgreSQL/MongoDB for production
3. **Monitoring**: Add logging, metrics, and alerting
4. **Authentication**: Add JWT validation for lender-specific access
5. **Rate Limiting**: Implement rate limits on create/update endpoints

## Testing

```bash
npm run lint
```

## Dependencies

- **express** - Web framework
- **zod** - Schema validation
- **bullmq** - Redis queue (default)
- **ioredis** - Redis client
- **amqplib** - RabbitMQ client (optional)
- **uuid** - ID generation
