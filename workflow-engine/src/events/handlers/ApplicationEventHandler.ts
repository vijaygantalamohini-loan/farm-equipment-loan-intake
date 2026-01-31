import { EventHandler, WorkflowEventPayload, WorkflowEventType } from '../types';
import axios from 'axios';

export class ApplicationEventHandler implements EventHandler {
  private applicationServiceUrl: string;

  constructor() {
    this.applicationServiceUrl = process.env.APPLICATION_SERVICE_URL || 'http://localhost:3006';
  }

  async handle(event: WorkflowEventPayload): Promise<void> {
    const applicationEvents = [
      WorkflowEventType.APPLICATION_SUBMITTED,
      WorkflowEventType.APPLICATION_APPROVED,
      WorkflowEventType.APPLICATION_REJECTED,
      WorkflowEventType.DECISION_READY,
    ];

    if (!applicationEvents.includes(event.type)) {
      return;
    }

    try {
      await axios.post(`${this.applicationServiceUrl}/webhooks/workflow`, {
        eventType: event.type,
        workflowInstanceId: event.workflowInstanceId,
        data: event,
        timestamp: event.timestamp,
      });
    } catch (error) {
      console.error('Failed to notify application service:', error);
      throw error;
    }
  }
}
