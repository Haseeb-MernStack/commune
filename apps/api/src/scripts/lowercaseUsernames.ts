/**
 * One-time migration: makes every saved username lowercase.
 *
 *   npm run lowercase-usernames -w @commune/api            (dry run: only shows what would change)
 *   npm run lowercase-usernames -w @commune/api -- --apply (makes the change)
 *
 * It is safe to run more than once, and safe on a live database:
 * - Usernames were already unique ignoring case (see the index in models/User.ts), so lowering
 *   them can never create a duplicate.
 * - Only accounts that are not lowercase yet are touched, in one update on the server.
 * - Nothing else changes. Profile links with capital letters keep working (the site redirects
 *   them to the lowercase address).
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

const notLowercase = { $expr: { $ne: ["$username", { $toLower: "$username" }] } };

async function main() {
  const apply = process.argv.includes("--apply");
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const count = await User.countDocuments(notLowercase);
  if (count === 0) {
    console.log("Every username is already lowercase. Nothing to do.");
    return;
  }

  const sample = await User.find(notLowercase).select("username").limit(10).lean();
  console.log(`${count} username(s) are not lowercase. Examples:`);
  for (const u of sample) console.log(`  ${u.username}  ->  ${u.username.toLowerCase()}`);

  if (!apply) {
    console.log("\nDry run: nothing was changed. Run again with --apply to make the change.");
    return;
  }

  // Skip schema casting so the server-side $toLower pipeline runs as written.
  const result = await User.updateMany(notLowercase, [
    { $set: { username: { $toLower: "$username" } } },
  ]);
  console.log(`\nDone. Updated ${result.modifiedCount} account(s).`);
}

main()
  .catch((err: unknown) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
