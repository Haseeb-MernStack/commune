import { Schema, model } from "mongoose";

const messageSchema = new Schema({
  conversation: { type: Schema.Types.ObjectId, ref: "Conversation", required: true },
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

messageSchema.index({ conversation: 1, createdAt: -1 });

export const Message = model("Message", messageSchema);
