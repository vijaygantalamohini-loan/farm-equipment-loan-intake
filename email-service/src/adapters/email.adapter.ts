export interface SendResult {
  success: boolean;
  provider: string;
  messageId?: string;
}

export interface EmailAdapter {
  send(to: string, subject: string, body: string): Promise<SendResult>;
}
