import { notificationService } from "../services/notification.service";

export interface DecisionReadyEvent {
  applicationId: string;
  lenderId: string;
  lenderPhone?: string;
  decision: "approved" | "rejected";
}

export async function handleDecisionReady(event: DecisionReadyEvent): Promise<void> {
  const tasks: Promise<any>[] = [];
  const decisionText = event.decision === "approved" ? "approved" : "rejected";

  if (event.lenderPhone) {
    tasks.push(
      notificationService.send({
        channel: "sms",
        recipientId: event.lenderId,
        message: `Decision ready for application ${event.applicationId}: ${decisionText}.`,
        phoneNumber: event.lenderPhone,
      })
    );
  }

  tasks.push(
    notificationService.send({
      channel: "inapp",
      recipientId: event.lenderId,
      title: "Decision Ready",
      message: `Application ${event.applicationId} decision: ${decisionText}.`,
    })
  );

  await Promise.all(tasks);
}
