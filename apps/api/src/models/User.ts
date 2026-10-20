import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 24 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    bio: { type: String, default: "", maxlength: 160 },
    avatarUrl: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true },
);

// Case-insensitive unique usernames ("Sam" and "sam" are the same person).
userSchema.index({ username: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
