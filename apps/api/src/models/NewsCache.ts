import { Schema, model } from "mongoose";

/**
 * The latest headlines per topic, shared by every server instance. A freshly started
 * serverless instance reads this (a few milliseconds) instead of downloading four RSS feeds
 * (several seconds) while the visitor waits.
 */
const newsCacheSchema = new Schema(
  {
    topic: { type: String, required: true, unique: true },
    items: { type: Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { versionKey: false },
);

export const NewsCache = model("NewsCache", newsCacheSchema);
