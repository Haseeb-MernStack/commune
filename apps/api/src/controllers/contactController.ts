import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ContactMessage } from "../models/ContactMessage.js";
import { sendMail } from "../services/mailService.js";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function send(req: Request, res: Response) {
  const { name, email, message, website } = req.body as {
    name: string;
    email: string;
    message: string;
    website?: string;
  };

  // Honeypot filled in: pretend it worked so bots learn nothing.
  if (website) return void res.status(201).json({ ok: true });

  await ContactMessage.create({ name, email, message });

  if (env.CONTACT_EMAIL) {
    // Best effort: the message is already saved, so a mail failure must not fail the request.
    try {
      await sendMail({
        to: env.CONTACT_EMAIL,
        subject: `Commune contact: ${name}`.slice(0, 120),
        text: `From: ${name} <${email}>\n\n${message}`,
        html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt;</p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
      });
    } catch (err) {
      logger.error({ err: String(err) }, "Could not email contact message");
    }
  }
  res.status(201).json({ ok: true });
}
