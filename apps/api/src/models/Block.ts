import { Schema, model } from "mongoose";
import { BLOCK_KINDS } from "@commune/shared";

/** "blocker" mutes or blocks "blocked". One row per pair; changing the kind updates the row. */
const blockSchema = new Schema(
  {
    blocker: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blocked: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: [...BLOCK_KINDS], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
// "Did this person block me?" checks on follow, like, comment and message.
blockSchema.index({ blocked: 1, kind: 1 });

export const Block = model("Block", blockSchema);
