import axios from "axios";
import { NotificationAdapter, SendResult } from "./notification.adapter";
import { SendNotificationDto } from "../dtos/send-notification.dto";

export class TwilioSmsAdapter implements NotificationAdapter {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || "";

    if (!this.accountSid || !this.authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required");
    }
  }

  async send(payload: SendNotificationDto): Promise<SendResult> {
    if (!payload.phoneNumber) {
      throw new Error("phoneNumber is required for SMS");
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");

    const response = await axios.post(
      url,
      new URLSearchParams({
        From: this.fromNumber,
        To: payload.phoneNumber,
        Body: payload.message,
      }),
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    return {
      success: true,
      provider: "twilio-sms",
      referenceId: response.data.sid,
    };
  }
}
