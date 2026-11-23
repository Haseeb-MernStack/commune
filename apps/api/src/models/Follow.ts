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
// Follower counts, and follower lists newest first (one page is read straight from the index).
followSchema.index({ following: 1, _id: -1 });
// "Following" lists newest first. Counts of who a person follows use the unique index above.
followSchema.index({ follower: 1, _id: -1 });

export const Follow = model("Follow", followSchema);
