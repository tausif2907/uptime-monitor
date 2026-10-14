import { Resend } from "resend";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

let client: Resend | null = null;

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

/**
 * Send an email via Resend. Without RESEND_API_KEY (local development) the email is printed to
 * the server console instead, and `delivered` is false so the UI can offer a dev shortcut.
 */
export async function sendEmail(email: Email): Promise<{ delivered: boolean }> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      // Never print bodies in production: they contain sign-in, verification and reset links.
      console.warn(`[email] RESEND_API_KEY is not set; "${email.subject}" was not sent.`);
      return { delivered: false };
    }
    console.log(`\n[email:dev] To: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
    return { delivered: false };
  }
  client ??= new Resend(process.env.RESEND_API_KEY);
  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM ?? "Uptime Monitor <onboarding@resend.dev>",
    to: email.to,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  if (error) throw new Error(`Email could not be sent: ${error.message}`);
  return { delivered: true };
}

/** Like sendEmail, but never throws: provider failures are logged and reported as `failed`. */
export async function trySendEmail(email: Email): Promise<{ delivered: boolean; failed: boolean }> {
  try {
    const { delivered } = await sendEmail(email);
    return { delivered, failed: false };
  } catch (err) {
    console.error(`[email] "${email.subject}" failed:`, (err as Error).message);
    return { delivered: false, failed: true };
  }
}

/** Simple branded HTML around one call-to-action button. Inputs are escaped. */
export function actionEmailHtml(opts: { heading: string; body: string; cta: string; url: string; footer?: string }) {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:480px;margin:32px auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e4e4e7">
    <p style="margin:0 0 24px;font-weight:700;color:#059669">● Uptime Monitor</p>
    <h1 style="margin:0 0 12px;font-size:20px;color:#18181b">${esc(opts.heading)}</h1>
    <p style="margin:0 0 24px;color:#52525b;line-height:1.5">${esc(opts.body)}</p>
    <a href="${esc(opts.url)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">${esc(opts.cta)}</a>
    <p style="margin:24px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5">${esc(opts.footer ?? "If you didn't request this, you can safely ignore this email.")}</p>
  </div></body></html>`;
}
