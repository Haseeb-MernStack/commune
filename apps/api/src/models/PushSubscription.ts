import { Schema, model } from "mongoose";

/** One browser or phone that agreed to receive push notifications. */
const pushSubscriptionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  endpoint: { type: String, required: true, unique: true, maxlength: 600 },
  p256dh: { type: String, required: true },
  auth: { type: String, required: true },
  userAgent: { type: String, default: "", maxlength: 120 },
  createdAt: { type: Date, default: Date.now },
});

export const PushSubscription = model("PushSubscription", pushSubscriptionSchema);
