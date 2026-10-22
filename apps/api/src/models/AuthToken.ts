import { Schema, model } from "mongoose";

/** One-time tokens sent by email. Only the SHA-256 hash is stored, like refresh tokens. */
const authTokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  purpose: { type: String, enum: ["verify_email", "reset_password"], required: true },
  tokenHash: { type: String, required: true, unique: true },
  // MongoDB removes the document automatically once expiresAt has passed.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});

export const AuthToken = model("AuthToken", authTokenSchema);
