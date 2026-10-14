import { Resend } from "resend";
import { config } from "./config";
import { logger } from "./logger";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

let client: Resend | null = null;

/** Send via Resend; without an API key (local dev) the email is logged instead. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!config.resendApiKey) {
    if (process.env.NODE_ENV === "production") {
      // Don't log recipients or bodies in production.
      logger.warn("RESEND_API_KEY not set; alert email not sent", { subject: message.subject });
    } else {
      logger.info("email (dev mode, not sent)", { ...message });
    }
    return;
  }
  client ??= new Resend(config.resendApiKey);
  const { error } = await client.emails.send({
    from: config.emailFrom,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
}
