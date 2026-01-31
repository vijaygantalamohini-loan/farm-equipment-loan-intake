import { EventHandler, WorkflowEventPayload, WorkflowEventType } from '../types';
import axios from 'axios';

export class UnderwritingEventHandler implements EventHandler {
  private underwritingServiceUrl: string;

  constructor() {
    this.underwritingServiceUrl = process.env.UNDERWRITING_SERVICE_URL || 'http://localhost:3007';
  }

  async handle(event: WorkflowEventPayload): Promise<void> {
    const underwritingEvents = [
      WorkflowEventType.UNDERWRITING_REQUESTED,
      WorkflowEventType.APPLICATION_SUBMITTED,
    ];

    if (!underwritingEvents.includes(event.type)) {
      return;
    }

    try {
      if (event.type === WorkflowEventType.UNDERWRITING_REQUESTED) {
        await axios.post(`${this.underwritingServiceUrl}/webhooks/workflow`, {
          eventType: event.type,
          workflowInstanceId: event.workflowInstanceId,
          data: event,
          timestamp: event.timestamp,
        });
      }
    } catch (error) {
      console.error('Failed to notify underwriting service:', error);
      throw error;
    }
  }
}
