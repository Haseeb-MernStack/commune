import { Schema, model } from "mongoose";

/** One Commune Plus subscription per user, mirrored from Lemon Squeezy webhooks. */
const subscriptionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    provider: { type: String, enum: ["lemonsqueezy", "mock"], required: true },
    providerSubscriptionId: { type: String, required: true, unique: true },
    providerCustomerId: { type: String, default: null },
    // Lemon Squeezy statuses: on_trial, active, paused, past_due, unpaid, cancelled, expired.
    status: { type: String, required: true },
    cancelled: { type: Boolean, default: false },
    renewsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    // The provider's own "updated_at" of the last snapshot applied. Webhooks can arrive out of
    // order, so an older snapshot must never overwrite a newer one.
    providerUpdatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

export const Subscription = model("Subscription", subscriptionSchema);
