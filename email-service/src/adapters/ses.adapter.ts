import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { fromEnv } from "@aws-sdk/credential-providers";
import { EmailAdapter, SendResult } from "./email.adapter";

export class SesAdapter implements EmailAdapter {
  private client: SESClient;
  private from: string;

  constructor() {
    const region = process.env.AWS_REGION || "us-east-1";
    this.from = process.env.SES_FROM || "no-reply@farm-equipment.local";

    this.client = new SESClient({
      region,
      credentials: process.env.AWS_ACCESS_KEY_ID ? fromEnv() : undefined,
    });
  }

  async send(to: string, subject: string, body: string): Promise<SendResult> {
    const command = new SendEmailCommand({
      Source: this.from,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: body },
        },
      },
    });

    const result = await this.client.send(command);
    return {
      success: true,
      provider: "ses",
      messageId: result.MessageId,
    };
  }
}
