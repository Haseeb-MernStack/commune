/**
 * Checks the main read queries against the indexes in apps/api/src/models.
 *
 * Run it against a local database:
 *   npm run explain               (from apps/api)
 *   npm run explain -w @commune/api   (from the repo root)
 *
 * Pass a username to run the user-specific queries as that person:
 *   npm run explain -w @commune/api -- <username>
 * Otherwise the first user in the database is used. With no users at all,
 * the user-specific queries are skipped.
 *
 * For each query it prints INDEX (with the index name) or SCAN, so a missing
 * index shows up as a scan instead of a silent slowdown. It exits with 1
 * when any query scans; see docs/INDEXES.md for the index that should serve it.
 */
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { Follow } from "../src/models/Follow.js";
import { Notification } from "../src/models/Notification.js";
import { Post } from "../src/models/Post.js";
import { User } from "../src/models/User.js";

type Plan = {
  stage?: string;
  indexName?: string;
  inputStage?: Plan;
  inputStages?: Plan[];
};

/** Walks a query-plan tree and collects every stage name, plus IXSCAN index names. */
function collectStages(plan: Plan | undefined, stages: string[], indexes: string[]): void {
  if (!plan) return;
  if (plan.stage) stages.push(plan.stage);
  if (plan.stage === "IXSCAN" && plan.indexName) indexes.push(plan.indexName);
  if (plan.inputStage) collectStages(plan.inputStage, stages, indexes);
  for (const child of plan.inputStages ?? []) collectStages(child, stages, indexes);
}

function describePlan(explain: unknown): { label: string; scanned: boolean } {
  const plan = (explain as { queryPlanner?: { winningPlan?: Plan } } | null | undefined)
    ?.queryPlanner?.winningPlan;
  const stages: string[] = [];
  const indexes: string[] = [];
  collectStages(plan, stages, indexes);
  if (stages.includes("COLLSCAN")) {
    return { label: `COLLSCAN (stages: ${stages.join(" > ")})`, scanned: true };
  }
  if (stages.includes("IXSCAN")) {
    return {
      label: `IXSCAN on ${indexes.join(", ") || "an index"} (stages: ${stages.join(" > ")})`,
      scanned: false,
    };
  }
  return { label: `no index stage (stages: ${stages.join(" > ") || "unknown"})`, scanned: true };
}

/** Prints one query's verdict. Returns true when the query scanned the collection. */
function report(name: string, explain: unknown): boolean {
  const { label, scanned } = describePlan(explain);
  console.log(`${scanned ? "SCAN " : "INDEX"} ${name}: ${label}`);
  return scanned;
}

async function main() {
  const username = process.argv[2];
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  let scanned = false;

  // Feed: everyone, newest first (postController listPosts + sendPostPage).
  scanned =
    report(
      "feed (all)",
      await Post.find({}).sort({ _id: -1 }).limit(21).explain("executionStats"),
    ) || scanned;

  const user = username
    ? await User.findOne({ username }).collation({ locale: "en", strength: 2 }).lean()
    : await User.findOne({}).sort({ _id: 1 }).lean();
  if (!user) {
    console.log("No users in the database, so the user-specific queries were skipped.");
    await mongoose.disconnect();
    process.exit(scanned ? 1 : 0);
  }
  const userId = user._id;

  // Feed: people I follow, newest first. The follow lookup is part of the feed.
  const follows = await Follow.find({ follower: userId }).select("following").lean();
  scanned =
    report(
      "feed (following authors)",
      await Follow.find({ follower: userId }).select("following").explain("executionStats"),
    ) || scanned;
  const authors = [...follows.map((f) => f.following), userId];
  scanned =
    report(
      "feed (following)",
      await Post.find({ author: { $in: authors } })
        .sort({ _id: -1 })
        .limit(21)
        .explain("executionStats"),
    ) || scanned;

  // Profile: the person (case-insensitive username), then their posts and counts.
  scanned =
    report(
      "profile (user lookup)",
      await User.findOne({ username: user.username })
        .collation({ locale: "en", strength: 2 })
        .explain("executionStats"),
    ) || scanned;
  scanned =
    report(
      "profile (posts)",
      await Post.find({ author: userId }).sort({ _id: -1 }).limit(21).explain("executionStats"),
    ) || scanned;
  scanned =
    report(
      "profile (follower count)",
      await Follow.countDocuments({ following: userId }).explain("executionStats"),
    ) || scanned;
  scanned =
    report(
      "profile (following count)",
      await Follow.countDocuments({ follower: userId }).explain("executionStats"),
    ) || scanned;
  scanned =
    report(
      "profile (post count)",
      await Post.countDocuments({ author: userId }).explain("executionStats"),
    ) || scanned;

  // Followers / following lists, newest first (userController followList).
  scanned =
    report(
      "followers",
      await Follow.find({ following: userId }).sort({ _id: -1 }).limit(21).explain("executionStats"),
    ) || scanned;
  scanned =
    report(
      "following",
      await Follow.find({ follower: userId }).sort({ _id: -1 }).limit(21).explain("executionStats"),
    ) || scanned;

  // Notifications: the list and the unread count (notificationController).
  scanned =
    report(
      "notifications",
      await Notification.find({ user: userId })
        .sort({ createdAt: -1 })
        .limit(30)
        .explain("executionStats"),
    ) || scanned;
  scanned =
    report(
      "notifications (unread count)",
      await Notification.countDocuments({ user: userId, read: false }).explain("executionStats"),
    ) || scanned;

  await mongoose.disconnect();
  if (scanned) {
    console.log(
      "At least one query scanned the collection. See docs/INDEXES.md for the index that should serve it.",
    );
    process.exit(1);
  }
  console.log("Every checked query used an index.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
