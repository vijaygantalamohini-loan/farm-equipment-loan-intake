import { EventHandler, WorkflowEventPayload, WorkflowEventType } from '../types';
import { NotificationQueue } from '../../queue/NotificationQueue';

export class NotificationEventHandler implements EventHandler {
  private notificationQueue: NotificationQueue;

  constructor() {
    this.notificationQueue = new NotificationQueue();
  }

  async handle(event: WorkflowEventPayload): Promise<void> {
    const notificationEvents = [
      WorkflowEventType.WORKFLOW_COMPLETED,
      WorkflowEventType.WORKFLOW_FAILED,
      WorkflowEventType.APPLICATION_APPROVED,
      WorkflowEventType.APPLICATION_REJECTED,
      WorkflowEventType.DECISION_READY,
      WorkflowEventType.UNDERWRITING_COMPLETED,
    ];

    if (!notificationEvents.includes(event.type)) {
      return;
    }

    await this.notificationQueue.addNotificationJob({
      eventType: event.type,
      workflowInstanceId: event.workflowInstanceId,
      entityId: (event as any).entityId,
      entityType: (event as any).entityType,
      data: event,
      timestamp: event.timestamp,
    });
  }
}
