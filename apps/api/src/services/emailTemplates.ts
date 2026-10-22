import type { Mail } from "./mailService.js";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(heading: string, intro: string, button: string, link: string, outro: string) {
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 12px">${escape(heading)}</h2>
<p>${escape(intro)}</p>
<p><a href="${escape(link)}" style="display:inline-block;background:#1f6f5c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${escape(button)}</a></p>
<p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escape(link)}</p>
<p style="color:#666;font-size:13px">${escape(outro)}</p>
</div>`;
  const text = `${heading}\n\n${intro}\n\n${link}\n\n${outro}`;
  return { html, text };
}

export function verifyEmailMail(to: string, username: string, link: string): Mail {
  const { html, text } = layout(
    "Confirm your email",
    `Hi ${username}, welcome to Commune. Confirm your email address to finish setting up your account. The link works for 24 hours.`,
    "Confirm email",
    link,
    "If you didn't create an account, you can ignore this email.",
  );
  return { to, subject: "Confirm your Commune email", text, html };
}

export function resetPasswordMail(to: string, username: string, link: string): Mail {
  const { html, text } = layout(
    "Reset your password",
    `Hi ${username}, someone asked to reset the password for your Commune account. The link works once, for 1 hour.`,
    "Choose a new password",
    link,
    "If this wasn't you, ignore this email. Your password stays the same.",
  );
  return { to, subject: "Reset your Commune password", text, html };
}
