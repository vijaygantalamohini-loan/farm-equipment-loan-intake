import { notificationService } from "../services/notification.service";

export interface ApplicationSubmittedEvent {
  applicationId: string;
  dealerId: string;
  farmerId: string;
  dealerPhone?: string;
  farmerPhone?: string;
}

export async function handleApplicationSubmitted(event: ApplicationSubmittedEvent): Promise<void> {
  const tasks: Promise<any>[] = [];

  if (event.dealerPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.dealerId,
        message: `Application ${event.applicationId} has been submitted successfully.`,
        phoneNumber: event.dealerPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.dealerId,
      title: "Application Submitted",
      message: `Your application ${event.applicationId} has been submitted.`,
    })
  );

  if (event.farmerPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.farmerId,
        message: `Your loan application has been submitted. Ref: ${event.applicationId}`,
        phoneNumber: event.farmerPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.farmerId,
      title: "Application Submitted",
      message: `Your application ${event.applicationId} has been submitted.`,
    })
  );

  await Promise.all(tasks);
}
