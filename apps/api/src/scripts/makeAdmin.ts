/**
 * Promotes an existing user to admin. Run from the repo root:
 *
 *   npm run make-admin -w @commune/api -- you@example.com
 *
 * This is deliberately a command-line step and not an API or a signup rule, so nobody can
 * become an admin by registering first with someone else's email address.
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run make-admin -w @commune/api -- you@example.com");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const user = await User.findOneAndUpdate({ email }, { $set: { role: "admin" } }, { new: true });
  await mongoose.disconnect();

  if (!user) {
    console.error(`No user found with email ${email}. Register that account first.`);
    process.exit(1);
  }
  console.log(`@${user.username} is now an admin. Log out and back in to see the Admin link.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
