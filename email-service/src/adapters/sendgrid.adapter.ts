import sgMail from "@sendgrid/mail";
import { EmailAdapter, SendResult } from "./email.adapter";

export class SendGridAdapter implements EmailAdapter {
  private from: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY || "";
    if (!apiKey) {
      throw new Error("SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid");
    }
    sgMail.setApiKey(apiKey);
    this.from = process.env.SENDGRID_FROM || "no-reply@farm-equipment.local";
  }

  async send(to: string, subject: string, body: string): Promise<SendResult> {
    const [response] = await sgMail.send({
      to,
      from: this.from,
      subject,
      html: body,
    });

    return {
      success: true,
      provider: "sendgrid",
      messageId: response.headers["x-message-id"] as string | undefined,
    };
  }
}
