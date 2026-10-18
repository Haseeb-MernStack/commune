import { Schema, model } from "mongoose";

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { timestamps: true },
);

commentSchema.index({ post: 1, _id: 1 });

export const Comment = model("Comment", commentSchema);
