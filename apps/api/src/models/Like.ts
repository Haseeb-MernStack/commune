import { Schema, model } from "mongoose";

const likeSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One like per user per post, enforced by the database.
likeSchema.index({ post: 1, user: 1 }, { unique: true });

export const Like = model("Like", likeSchema);
