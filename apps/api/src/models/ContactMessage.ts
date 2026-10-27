import { Schema, model } from "mongoose";

const contactMessageSchema = new Schema({
  name: { type: String, required: true, maxlength: 60 },
  email: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

export const ContactMessage = model("ContactMessage", contactMessageSchema);
