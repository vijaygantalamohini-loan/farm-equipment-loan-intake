import { notificationService } from "../services/notification.service";

export interface ApplicationRejectedEvent {
  applicationId: string;
  dealerId: string;
  farmerId: string;
  dealerPhone?: string;
  farmerPhone?: string;
  reason?: string;
}

export async function handleApplicationRejected(event: ApplicationRejectedEvent): Promise<void> {
  const tasks: Promise<any>[] = [];
  const reasonText = event.reason ? ` Reason: ${event.reason}` : "";

  if (event.dealerPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.dealerId,
        message: `Application ${event.applicationId} has been declined.${reasonText}`,
        phoneNumber: event.dealerPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.dealerId,
      title: "Application Declined",
      message: `Application ${event.applicationId} has been declined.${reasonText}`,
    })
  );

  if (event.farmerPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.farmerId,
        message: `Your loan application has been declined.${reasonText}`,
        phoneNumber: event.farmerPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.farmerId,
      title: "Application Declined",
      message: `Your loan application has been declined.${reasonText}`,
    })
  );

  await Promise.all(tasks);
}
