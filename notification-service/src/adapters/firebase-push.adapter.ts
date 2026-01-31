import axios from "axios";
import { NotificationAdapter, SendResult } from "./notification.adapter";
import { SendNotificationDto } from "../dtos/send-notification.dto";

export class FirebasePushAdapter implements NotificationAdapter {
  private projectId: string;
  private privateKey: string;
  private clientEmail: string;

  constructor() {
    this.projectId = process.env.FIREBASE_PROJECT_ID || "";
    this.privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
    this.clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";

    if (!this.projectId || !this.privateKey || !this.clientEmail) {
      throw new Error("Firebase credentials are required");
    }
  }

  async send(payload: SendNotificationDto): Promise<SendResult> {
    const token = await this.getAccessToken();

    const message = {
      webpush: {
        notification: {
          title: payload.title || "Notification",
          body: payload.message,
        },
        data: payload.data || {},
      },
    };

    const url = `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`;
    const response = await axios.post(
      url,
      { message: { ...message, token: payload.recipientId } },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      success: true,
      provider: "firebase-push",
      referenceId: response.data.name,
    };
  }

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.clientEmail,
      sub: this.clientEmail,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };

    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64");
    const signature = this.sign(`${header}.${body}`);
    const token = `${header}.${body}.${signature}`;

    const response = await axios.post("https://oauth2.googleapis.com/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token,
    });

    return response.data.access_token;
  }

  private sign(data: string): string {
    const crypto = require("crypto");
    return crypto.createSign("RSA-SHA256").update(data).sign(this.privateKey, "base64");
  }
}
