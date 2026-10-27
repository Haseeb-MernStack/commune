import { Schema, model } from "mongoose";

/** One row per viewer per post per day. Powers the view counts on the Insights page. */
const postViewSchema = new Schema({
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  viewer: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // UTC calendar day, "YYYY-MM-DD".
  day: { type: String, required: true },
  // Rows are removed automatically after 90 days; Insights only looks back 30.
  createdAt: { type: Date, default: Date.now, index: { expireAfterSeconds: 90 * 24 * 60 * 60 } },
});

// A viewer counts once per post per day, even if they open it ten times.
postViewSchema.index({ post: 1, viewer: 1, day: 1 }, { unique: true });
// Per-author daily totals.
postViewSchema.index({ author: 1, day: 1 });

export const PostView = model("PostView", postViewSchema);
