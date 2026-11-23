import type { Types } from "mongoose";
import { Block } from "../models/Block.js";
import { forbidden } from "../utils/errors.js";

/** The only thing a blocked person is ever told. It must not mention blocking. */
export const BLOCKED_MESSAGE = "This action isn't available";

type Id = string | Types.ObjectId;

/** People whose posts this viewer does not want to see: muted and blocked. */
export async function hiddenAuthorIds(viewerId: string): Promise<Types.ObjectId[]> {
  const rows = await Block.find({ blocker: viewerId }).select("blocked").lean();
  return rows.map((r) => r.blocked);
}

/** People this viewer has blocked (not just muted). */
export async function blockedByMeIds(viewerId: string): Promise<Types.ObjectId[]> {
  const rows = await Block.find({ blocker: viewerId, kind: "block" }).select("blocked").lean();
  return rows.map((r) => r.blocked);
}

/** Refuses with a neutral error when `targetId` has blocked `actorId`. */
export async function assertNotBlockedBy(actorId: Id, targetId: Id): Promise<void> {
  if (await Block.exists({ blocker: targetId, blocked: actorId, kind: "block" })) {
    throw forbidden(BLOCKED_MESSAGE);
  }
}

/** Messaging needs both directions: they blocked me (neutral error) or I blocked them (say how to fix it). */
export async function assertCanMessage(actorId: string, targetId: string): Promise<void> {
  const rows = await Block.find({
    kind: "block",
    $or: [
      { blocker: actorId, blocked: targetId },
      { blocker: targetId, blocked: actorId },
    ],
  })
    .select("blocker")
    .lean();
  if (rows.some((r) => String(r.blocker) === targetId)) throw forbidden(BLOCKED_MESSAGE);
  if (rows.length > 0) throw forbidden("Unblock this person to message them");
}
