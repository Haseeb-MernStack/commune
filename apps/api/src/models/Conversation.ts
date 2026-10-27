import { Schema, model } from "mongoose";

/**
 * A one-to-one chat. `key` is the two user ids, sorted and joined, so a pair of people can
 * only ever have one conversation (and concurrent "start chat" requests cannot create two).
 */
const conversationSchema = new Schema({
  key: { type: String, required: true, unique: true },
  participants: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], required: true },
  lastMessageText: { type: String, default: "" },
  lastMessageSender: { type: Schema.Types.ObjectId, ref: "User", default: null },
  lastMessageAt: { type: Date, default: Date.now },
  // Unread count per participant, keyed by user id.
  unread: { type: Map, of: Number, default: {} },
});

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = model("Conversation", conversationSchema);
