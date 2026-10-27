import type { Request, Response } from "express";
import mongoose from "mongoose";
import type { ConversationDTO, MessageDTO, MessagePage } from "@commune/shared";
import { Conversation } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { badRequest, forbidden, notFound } from "../utils/errors.js";
import { isPlusActive } from "../utils/plan.js";
import { findByUsername } from "./userController.js";

const PREVIEW_LENGTH = 120;
const USER_FIELDS = "username bio avatarUrl plusUntil banned";

interface LeanUser {
  _id: unknown;
  username: string;
  bio?: string;
  avatarUrl?: string | null;
  plusUntil?: Date | null;
}
interface LeanConversation {
  _id: unknown;
  participants: unknown[];
  lastMessageText?: string;
  lastMessageSender?: unknown;
  lastMessageAt: Date;
  unread?: Record<string, number> | null;
}
interface LeanMessage {
  _id: unknown;
  conversation: unknown;
  sender: unknown;
  text: string;
  createdAt: Date;
}

const str = (v: unknown) => String(v);
const pairKey = (a: string, b: string) => [a, b].sort().join(":");

function toMessageDTO(m: LeanMessage): MessageDTO {
  return {
    id: str(m._id),
    conversationId: str(m.conversation),
    senderId: str(m.sender),
    text: m.text,
    createdAt: m.createdAt.toISOString(),
  };
}

function toConversationDTO(c: LeanConversation, me: string, other: LeanUser): ConversationDTO {
  const unread = c.unread && typeof c.unread === "object" ? Number(c.unread[me] ?? 0) : 0;
  return {
    id: str(c._id),
    other: {
      id: str(other._id),
      username: other.username,
      bio: other.bio ?? "",
      avatarUrl: other.avatarUrl ?? null,
      plus: isPlusActive(other.plusUntil),
    },
    lastMessage: c.lastMessageText
      ? {
          text: c.lastMessageText,
          senderId: str(c.lastMessageSender),
          createdAt: c.lastMessageAt.toISOString(),
        }
      : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread,
  };
}

/** Loads a conversation and makes sure the caller is one of its two participants. */
async function loadConversation(id: string | undefined, me: string) {
  if (!id || !mongoose.isValidObjectId(id)) throw notFound("Conversation not found");
  const convo = (await Conversation.findById(id).lean()) as LeanConversation | null;
  // Same answer for "doesn't exist" and "not yours" so ids can't be probed.
  if (!convo || !convo.participants.some((p) => str(p) === me)) throw notFound("Conversation not found");
  const otherId = convo.participants.map(str).find((p) => p !== me);
  return { convo, otherId: otherId ?? me };
}

async function saveMessage(convoId: string, me: string, otherId: string, text: string) {
  const message = await Message.create({ conversation: convoId, sender: me, text });
  await Conversation.updateOne(
    { _id: convoId },
    {
      $set: {
        lastMessageText: text.slice(0, PREVIEW_LENGTH),
        lastMessageSender: me,
        lastMessageAt: message.createdAt,
      },
      $inc: { [`unread.${otherId}`]: 1 },
    },
  );
  return toMessageDTO(message.toObject() as unknown as LeanMessage);
}

/** GET /messages: your conversations, most recent first. */
export async function listConversations(req: Request, res: Response) {
  const me = req.userId!;
  const convos = (await Conversation.find({ participants: me })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean()) as unknown as LeanConversation[];

  const otherIds = convos.map((c) => c.participants.map(str).find((p) => p !== me) ?? me);
  const users = (await User.find({ _id: { $in: otherIds } })
    .select(USER_FIELDS)
    .lean()) as unknown as (LeanUser & { banned?: boolean })[];
  const byId = new Map(users.map((u) => [str(u._id), u]));

  const out: ConversationDTO[] = [];
  convos.forEach((c, i) => {
    const other = byId.get(otherIds[i]!);
    if (other && !other.banned) out.push(toConversationDTO(c, me, other));
  });
  res.json(out);
}

/** GET /messages/unread-count: how many conversations have unread messages. */
export async function unreadCount(req: Request, res: Response) {
  const me = req.userId!;
  const count = await Conversation.countDocuments({
    participants: me,
    [`unread.${me}`]: { $gt: 0 },
  });
  res.json({ count });
}

/** GET /messages/:id: a page of messages (newest page first request; older via cursor). */
export async function getMessages(req: Request, res: Response) {
  const me = req.userId!;
  const { convo, otherId } = await loadConversation(req.params.id, me);
  const { cursor, limit } = res.locals.query as { cursor?: string; limit: number };

  const rows = (await Message.find({
    conversation: str(convo._id),
    ...(cursor ? { createdAt: { $lt: new Date(cursor) } } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .lean()) as unknown as LeanMessage[];

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit); // newest first
  const nextCursor = hasMore ? page[page.length - 1]!.createdAt.toISOString() : null;

  // Opening the latest page counts as reading the conversation.
  if (!cursor && Number(convo.unread?.[me] ?? 0) > 0) {
    await Conversation.updateOne({ _id: str(convo._id) }, { $set: { [`unread.${me}`]: 0 } });
  }

  const other = (await User.findById(otherId).select(USER_FIELDS).lean()) as unknown as LeanUser | null;
  const result: MessagePage & { conversation?: ConversationDTO } = {
    items: page.reverse().map(toMessageDTO), // oldest first for display
    nextCursor,
  };
  if (!cursor && other) result.conversation = toConversationDTO(convo, me, other);
  res.json(result);
}

/** POST /messages/:id: reply in an existing conversation. */
export async function send(req: Request, res: Response) {
  const me = req.userId!;
  const { convo, otherId } = await loadConversation(req.params.id, me);
  const other = (await User.findById(otherId).select("banned").lean()) as { banned?: boolean } | null;
  if (!other || other.banned) throw forbidden("You can't message this account");
  res.status(201).json(await saveMessage(str(convo._id), me, otherId, req.body.text));
}

/** POST /messages/with/:username: send to a person, creating the conversation if needed. */
export async function start(req: Request, res: Response) {
  const me = req.userId!;
  const target = await findByUsername(req.params.username);
  const targetId = str(target._id);
  if (targetId === me) throw badRequest("You can't message yourself");
  if (target.banned) throw forbidden("You can't message this account");

  const key = pairKey(me, targetId);
  const convo = (await Conversation.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, participants: [me, targetId], lastMessageAt: new Date() } },
    { upsert: true, new: true },
  ).lean()) as unknown as LeanConversation;

  const message = await saveMessage(str(convo._id), me, targetId, req.body.text);
  res.status(201).json({ conversationId: str(convo._id), message });
}
