import nodemailer from "nodemailer";
import { EmailAdapter, SendResult } from "./email.adapter";

export class SmtpAdapter implements EmailAdapter {
  private transporter: nodemailer.Transporter;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST || "localhost";
    const port = Number(process.env.SMTP_PORT || 1025);
    const user = process.env.SMTP_USER || "";
    const pass = process.env.SMTP_PASS || "";
    const secure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
    this.from = process.env.SMTP_FROM || "no-reply@farm-equipment.local";

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(to: string, subject: string, body: string): Promise<SendResult> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html: body,
    });

    return {
      success: true,
      provider: "smtp",
      messageId: info.messageId,
    };
  }
}
