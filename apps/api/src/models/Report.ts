import { Schema, model } from "mongoose";
import { REPORT_REASONS, REPORT_STATUSES } from "@commune/shared";

const reportSchema = new Schema({
  reporter: { type: Schema.Types.ObjectId, ref: "User", required: true },
  post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
  reason: { type: String, enum: [...REPORT_REASONS], required: true },
  details: { type: String, default: "", maxlength: 300 },
  status: { type: String, enum: [...REPORT_STATUSES], default: "open" },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

// Each person can report a given post once (this also blocks report spam).
reportSchema.index({ reporter: 1, post: 1 }, { unique: true });
// The admin queue: newest reports of a given status.
reportSchema.index({ status: 1, _id: -1 });
reportSchema.index({ post: 1 });

export const Report = model("Report", reportSchema);
