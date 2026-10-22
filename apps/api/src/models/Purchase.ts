import { Schema, model } from "mongoose";

/** One row per unlocked post per buyer. Also the ledger creators' earnings are summed from. */
const purchaseSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // All amounts are in the smallest currency unit (cents). gross = fee + creatorShare.
    amountCents: { type: Number, required: true, min: 0 },
    feeCents: { type: Number, required: true, min: 0 },
    creatorShareCents: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "USD" },
    provider: { type: String, enum: ["lemonsqueezy", "mock"], required: true },
    // The provider's order id. Unique, so a webhook delivered twice cannot double-count.
    providerOrderId: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

// A buyer unlocks a given post once.
purchaseSchema.index({ user: 1, post: 1 }, { unique: true });

export const Purchase = model("Purchase", purchaseSchema);
