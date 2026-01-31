import { notificationService } from "../services/notification.service";

export interface UnderwritingRequestedEvent {
  applicationId: string;
  lenderId: string;
  lenderPhone?: string;
  dealerName?: string;
  farmerName?: string;
}

export async function handleUnderwritingRequested(event: UnderwritingRequestedEvent): Promise<void> {
  const tasks: Promise<any>[] = [];
  const referenceText = `Dealer: ${event.dealerName || "N/A"} | Farmer: ${event.farmerName || "N/A"}`;

  if (event.lenderPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.lenderId,
        message: `Application ${event.applicationId} is ready for underwriting. ${referenceText}`,
        phoneNumber: event.lenderPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.lenderId,
      title: "Underwriting Request",
      message: `Application ${event.applicationId} ready for underwriting. ${referenceText}`,
    })
  );

  await Promise.all(tasks);
}
