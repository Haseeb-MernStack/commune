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
import { logger } from "../config/logger.js";
import { User } from "../models/User.js";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    logger.error("Usage: npm run make-admin -w @commune/api -- you@example.com");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  const user = await User.findOneAndUpdate({ email }, { $set: { role: "admin" } }, { new: true });
  await mongoose.disconnect();

  if (!user) {
    logger.error(`No user found with email ${email}. Register that account first.`);
    process.exit(1);
  }
  logger.info(`@${user.username} is now an admin. Log out and back in to see the Admin link.`);
}

main().catch((err) => {
  logger.error({ err }, "Failed to promote the user to admin");
  process.exit(1);
});
