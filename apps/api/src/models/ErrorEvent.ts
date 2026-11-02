import { Schema, model } from "mongoose";

/**
 * One row per distinct error (grouped by fingerprint) with a counter, so a bug that happens a
 * thousand times is one line, not a thousand. Rows expire 30 days after they last occurred.
 */
const errorEventSchema = new Schema({
  fingerprint: { type: String, required: true, unique: true },
  source: { type: String, enum: ["api", "web"], required: true },
  message: { type: String, required: true, maxlength: 300 },
  route: { type: String, default: "", maxlength: 200 },
  status: { type: Number, default: null },
  stack: { type: String, default: "", maxlength: 2000 },
  count: { type: Number, default: 1 },
  firstSeen: { type: Date, default: Date.now },
  lastSeen: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 },
  resolved: { type: Boolean, default: false },
});
errorEventSchema.index({ resolved: 1, lastSeen: -1 });

export const ErrorEvent = model("ErrorEvent", errorEventSchema);
