export type EmailStatus = "queued" | "sent" | "failed";

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  status: EmailStatus;
  createdAt: string;
  provider?: string;
  messageId?: string;
}

export interface EmailFailure {
  id: string;
  payload: unknown;
  error: string;
  createdAt: string;
}
