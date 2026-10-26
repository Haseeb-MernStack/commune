import { Schema, model } from "mongoose";

const communitySchema = new Schema(
  {
    // URL-safe, lowercase, unique: /c/<slug>
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    description: { type: String, default: "", maxlength: 280 },
    creator: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Kept in step with Membership rows (like likeCount on posts) so lists need no counting.
    memberCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// "Most popular first" lists.
communitySchema.index({ memberCount: -1, _id: -1 });

export const Community = model("Community", communitySchema);
