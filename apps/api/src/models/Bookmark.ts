import { Schema, model } from "mongoose";

const bookmarkSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One save per user per post, enforced by the database.
bookmarkSchema.index({ post: 1, user: 1 }, { unique: true });
// "My saved posts", newest save first, paged by _id.
bookmarkSchema.index({ user: 1, _id: -1 });

export const Bookmark = model("Bookmark", bookmarkSchema);
