import { env, isProd } from "../config/env.js";
import { logger } from "../config/logger.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Sends one email. With RESEND_API_KEY set it calls the Resend HTTP API (no SMTP, no extra
 * dependency). Without a key it prints the message to the log in development so you can click
 * the link, and does nothing in production (so tokens never land in production logs).
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!env.RESEND_API_KEY) {
    if (isProd) {
      logger.warn({ to: mail.to, subject: mail.subject }, "Email not sent: RESEND_API_KEY is not set");
    } else {
      logger.info(`\n--- EMAIL to ${mail.to} ---\n${mail.subject}\n\n${mail.text}\n---`);
    }
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Email provider returned ${res.status}: ${detail.slice(0, 200)}`);
  }
}
