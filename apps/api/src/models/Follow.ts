import { Schema, model } from "mongoose";

const followSchema = new Schema(
  {
    follower: { type: Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One follow per pair, enforced by the database.
followSchema.index({ follower: 1, following: 1 }, { unique: true });
// Fast follower counts and follower lists.
followSchema.index({ following: 1 });

export const Follow = model("Follow", followSchema);
