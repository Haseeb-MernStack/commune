import { Schema, model } from "mongoose";

const membershipSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    community: { type: Schema.Types.ObjectId, ref: "Community", required: true },
    role: { type: String, enum: ["owner", "member"], default: "member" },
  },
  { timestamps: true },
);

// One membership per person per community; also makes joins safe under double clicks.
membershipSchema.index({ user: 1, community: 1 }, { unique: true });
membershipSchema.index({ community: 1 });

export const Membership = model("Membership", membershipSchema);
