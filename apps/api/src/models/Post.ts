import { Schema, model } from "mongoose";

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, trim: true, maxlength: 2000, default: "" },
    imageUrl: { type: String, default: null, index: true, sparse: true },
    // Pixel size of the image, so feeds can reserve its space before it loads. Null for older
    // posts and for posts made without the size.
    imageWidth: { type: Number, default: null, min: 1 },
    imageHeight: { type: Number, default: null, min: 1 },
    // Set when the post was made inside a community.
    community: { type: Schema.Types.ObjectId, ref: "Community", default: null, index: true },
    // Paid posts: price in US cents and the content that is hidden until purchase.
    priceCents: { type: Number, default: null, min: 100 },
    premiumContent: { type: String, default: null, maxlength: 5000 },
    // Set when the author edits the text after posting.
    editedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

// Feeds list posts newest first (sorted by _id), for everyone, for the people you follow and per
// community. These indexes let MongoDB read exactly one page instead of sorting many posts.
postSchema.index({ author: 1, _id: -1 });
postSchema.index({ community: 1, _id: -1 });

// Trending reads the last day's posts by age, so it needs to find them by createdAt.
postSchema.index({ createdAt: -1 });

// Full-text search over the free text only. premiumContent is deliberately NOT indexed, so
// searching can never reveal paid content.
postSchema.index({ content: "text" });

export const Post = model("Post", postSchema);
