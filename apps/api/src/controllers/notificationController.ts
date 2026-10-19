import type { Request, Response } from "express";
import { Notification } from "../models/Notification.js";
import { toNotificationDTO, type PopulatedNotification } from "../utils/serializers.js";

export async function list(req: Request, res: Response) {
  const rows = (await Notification.find({ user: req.userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate("actor", "username")
    .lean()) as unknown as PopulatedNotification[];
  res.json(rows.map(toNotificationDTO));
}

export async function unreadCount(req: Request, res: Response) {
  const count = await Notification.countDocuments({ user: req.userId, read: false });
  res.json({ count });
}

export async function markAllRead(req: Request, res: Response) {
  await Notification.updateMany({ user: req.userId, read: false }, { $set: { read: true } });
  res.status(204).end();
}
