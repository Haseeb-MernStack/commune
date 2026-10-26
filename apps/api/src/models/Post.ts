import { Schema, model } from "mongoose";

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, trim: true, maxlength: 500, default: "" },
    imageUrl: { type: String, default: null, index: true, sparse: true },
    // Set when the post was made inside a community.
    community: { type: Schema.Types.ObjectId, ref: "Community", default: null, index: true },
    // Paid posts: price in US cents and the content that is hidden until purchase.
    priceCents: { type: Number, default: null, min: 100 },
    premiumContent: { type: String, default: null, maxlength: 5000 },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Full-text search over the free text only. premiumContent is deliberately NOT indexed, so
// searching can never reveal paid content.
postSchema.index({ content: "text" });

export const Post = model("Post", postSchema);
