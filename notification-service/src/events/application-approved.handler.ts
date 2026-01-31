import { notificationService } from "../services/notification.service";

export interface ApplicationApprovedEvent {
  applicationId: string;
  dealerId: string;
  farmerId: string;
  dealerPhone?: string;
  farmerPhone?: string;
  approvalAmount?: string;
}

export async function handleApplicationApproved(event: ApplicationApprovedEvent): Promise<void> {
  const tasks: Promise<any>[] = [];

  if (event.dealerPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.dealerId,
        message: `Good news! Application ${event.applicationId} has been approved.`,
        phoneNumber: event.dealerPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.dealerId,
      title: "Application Approved",
      message: `Application ${event.applicationId} approved. Amount: ${event.approvalAmount || "TBD"}`,
    })
  );

  if (event.farmerPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.farmerId,
        message: `Congratulations! Your loan application has been approved.`,
        phoneNumber: event.farmerPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.farmerId,
      title: "Application Approved",
      message: `Your loan has been approved for ${event.approvalAmount || "an amount TBD"}.`,
    })
  );

  await Promise.all(tasks);
}
