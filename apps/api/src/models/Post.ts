import { Schema, model } from "mongoose";

const postSchema = new Schema(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    content: { type: String, trim: true, maxlength: 500, default: "" },
    imageUrl: { type: String, default: null, index: true, sparse: true },
    likeCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

export const Post = model("Post", postSchema);
