import { Schema, model } from "mongoose";

/**
 * One row per use of something that costs money or can be abused (an email sent, an upload, a
 * checkout). Counting rows in a time window gives a limit that is shared by every server
 * instance, unlike an in-memory counter on a serverless host.
 */
const quotaLogSchema = new Schema({
  bucket: { type: String, required: true, maxlength: 60 },
  // Who or what it is counted against: a user id, an email address, an IP, or "site".
  subject: { type: String, required: true, maxlength: 200 },
  createdAt: { type: Date, default: Date.now },
});

quotaLogSchema.index({ bucket: 1, subject: 1, createdAt: -1 });
// Longest window used anywhere is 24 hours, so a day and a bit is plenty.
quotaLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 26 * 60 * 60 });

export const QuotaLog = model("QuotaLog", quotaLogSchema);
