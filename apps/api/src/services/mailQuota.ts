import { env } from "../config/env.js";
import { DAY, HOUR, QuotaError, consumeQuota, type QuotaRule } from "./quota.js";

export type MailKind = "verify_email" | "reset_password" | "contact" | "alert";

/** Per address and per visitor, so one inbox cannot be flooded and one visitor cannot spend the allowance. */
export const MAIL_LIMITS = {
  perAddress: [
    { limit: 3, windowMs: HOUR },
    { limit: 6, windowMs: DAY },
  ],
  perIp: [
    { limit: 10, windowMs: HOUR },
    { limit: 30, windowMs: DAY },
  ],
  contactPerIp: [{ limit: 5, windowMs: DAY }],
  contactAll: [{ limit: 30, windowMs: DAY }],
  alerts: [{ limit: 5, windowMs: HOUR }],
};

/**
 * Must be called before an email is created or sent. Throws a 429 when the address, the visitor or
 * the whole site has used up its allowance (EMAIL_DAILY_LIMIT a day, to stay inside the Resend plan).
 */
export async function reserveMail(opts: {
  kind: MailKind;
  to?: string;
  ip?: string;
}): Promise<void> {
  const { kind, to, ip } = opts;
  const rules: QuotaRule[] = [];

  if (kind === "verify_email" || kind === "reset_password") {
    if (to) rules.push({ bucket: `mail:${kind}:to`, subject: to, windows: MAIL_LIMITS.perAddress });
    if (ip) rules.push({ bucket: "mail:user:ip", subject: ip, windows: MAIL_LIMITS.perIp });
    rules.push({
      bucket: "mail:all",
      subject: "site",
      windows: [{ limit: env.EMAIL_DAILY_LIMIT, windowMs: DAY }],
    });
  } else if (kind === "contact") {
    if (ip)
      rules.push({ bucket: "mail:contact:ip", subject: ip, windows: MAIL_LIMITS.contactPerIp });
    rules.push({ bucket: "mail:contact:all", subject: "site", windows: MAIL_LIMITS.contactAll });
  } else {
    rules.push({ bucket: "mail:alert", subject: "site", windows: MAIL_LIMITS.alerts });
  }

  try {
    await consumeQuota(rules);
  } catch (err) {
    if (err instanceof QuotaError) {
      throw new QuotaError(
        kind === "contact"
          ? "You've sent a lot of messages today. Please try again tomorrow."
          : "Too many emails were requested. Please wait a while and try again.",
      );
    }
    throw err;
  }
}
