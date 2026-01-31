import { EmailAdapter } from "./email.adapter";
import { SmtpAdapter } from "./smtp.adapter";
import { SendGridAdapter } from "./sendgrid.adapter";
import { SesAdapter } from "./ses.adapter";

export function getEmailAdapter(): EmailAdapter {
  const provider = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();

  switch (provider) {
    case "sendgrid":
      return new SendGridAdapter();
    case "ses":
      return new SesAdapter();
    case "smtp":
    default:
      return new SmtpAdapter();
  }
}
