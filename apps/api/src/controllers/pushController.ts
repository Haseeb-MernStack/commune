import type { Request, Response } from "express";
import type { PushPreferences, PushStatus, PushSubscribeInput } from "@commune/shared";
import { env } from "../config/env.js";
import { PushSubscription } from "../models/PushSubscription.js";
import { User } from "../models/User.js";
import { pushConfigured, pushToUser } from "../services/pushService.js";

const MAX_DEVICES = 10;

export async function status(req: Request, res: Response) {
  const user = (await User.findById(req.userId).select("pushMessages pushSocial").lean()) as {
    pushMessages?: boolean;
    pushSocial?: boolean;
  } | null;
  const body: PushStatus = {
    enabled: pushConfigured(),
    publicKey: pushConfigured() ? (env.VAPID_PUBLIC_KEY ?? null) : null,
    preferences: { messages: user?.pushMessages !== false, social: user?.pushSocial !== false },
  };
  res.json(body);
}

export async function subscribe(req: Request, res: Response) {
  if (!pushConfigured())
    return void res.status(503).json({ error: "Push notifications are not set up" });
  const me = req.userId!;
  const { endpoint, keys } = req.body as PushSubscribeInput;

  // The same device signing in as someone else takes the subscription over from the old account.
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      $set: {
        user: me,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: (req.get("user-agent") ?? "").slice(0, 120),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  // Keep the newest few devices per person.
  if ((await PushSubscription.countDocuments({ user: me })) > MAX_DEVICES) {
    const extra = await PushSubscription.find({ user: me })
      .sort({ createdAt: -1 })
      .skip(MAX_DEVICES)
      .select("_id")
      .lean();
    await PushSubscription.deleteMany({ _id: { $in: extra.map((e) => e._id) } });
  }
  res.status(204).end();
}

export async function unsubscribe(req: Request, res: Response) {
  const { endpoint } = req.body as { endpoint: string };
  await PushSubscription.deleteOne({ user: req.userId, endpoint });
  res.status(204).end();
}

export async function savePreferences(req: Request, res: Response) {
  const { messages, social } = req.body as PushPreferences;
  await User.updateOne(
    { _id: req.userId },
    { $set: { pushMessages: messages, pushSocial: social } },
  );
  res.status(204).end();
}

/** Sends a notification to the caller's own devices, to check that everything works. */
export async function test(req: Request, res: Response) {
  if (!pushConfigured())
    return void res.status(503).json({ error: "Push notifications are not set up" });
  await pushToUser(req.userId!, "test", {
    title: "Commune",
    body: "Notifications are working on this device.",
    url: "/notifications",
    tag: "test",
  });
  res.status(204).end();
}
