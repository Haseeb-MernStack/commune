import type { Request, Response } from "express";
import { communitySlugSchema } from "@commune/shared";
import type { CommunityDTO } from "@commune/shared";
import { Community } from "../models/Community.js";
import { User } from "../models/User.js";
import { isPlusActive } from "../utils/plan.js";
import { Membership } from "../models/Membership.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/errors.js";
import { escapeRegex } from "../utils/regex.js";
import { toCommunityDTO } from "../utils/serializers.js";
import { sendPostPage } from "./postController.js";

const MAX_COMMUNITIES_FREE = 5;
const MAX_COMMUNITIES_PLUS = 20;
const LIST_LIMIT = 30;

async function findBySlug(raw: string | undefined) {
  const parsed = communitySlugSchema.safeParse(raw);
  if (!parsed.success) throw notFound("Community not found");
  const community = await Community.findOne({ slug: parsed.data }).lean();
  if (!community) throw notFound("Community not found");
  return community;
}

const isDuplicate = (err: unknown) => (err as { code?: number }).code === 11000;

export async function create(req: Request, res: Response) {
  const { slug, name, description } = req.body as { slug: string; name: string; description: string };

  // A cap keeps one account from claiming every good name.
  const [owned, owner] = await Promise.all([
    Community.countDocuments({ creator: req.userId }),
    User.findById(req.userId).select("plusUntil").lean(),
  ]);
  const cap = isPlusActive(owner?.plusUntil) ? MAX_COMMUNITIES_PLUS : MAX_COMMUNITIES_FREE;
  if (owned >= cap) {
    throw forbidden(
      cap === MAX_COMMUNITIES_FREE
        ? `You can create up to ${cap} communities. Commune Plus raises this to ${MAX_COMMUNITIES_PLUS}.`
        : `You can create up to ${cap} communities`,
    );
  }

  let community;
  try {
    community = await Community.create({
      slug,
      name,
      description,
      creator: req.userId,
      memberCount: 1,
    });
  } catch (err) {
    if (isDuplicate(err)) throw conflict("That community address is already taken");
    throw err;
  }
  await Membership.create({ user: req.userId, community: community._id, role: "owner" });
  res.status(201).json(toCommunityDTO(community, "owner"));
}

/** Most popular communities, optionally filtered by text, or only the ones I belong to. */
export async function list(req: Request, res: Response) {
  const { q, mine } = (res.locals as { query: { q?: string; mine?: "1" } }).query;

  const memberships = await Membership.find({ user: req.userId }).select("community role").lean();
  const roles = new Map(memberships.map((m) => [m.community.toString(), m.role]));

  const filter: Record<string, unknown> = {};
  if (mine) filter._id = { $in: memberships.map((m) => m.community) };
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [{ slug: pattern }, { name: pattern }];
  }

  const rows = await Community.find(filter).sort({ memberCount: -1, _id: -1 }).limit(LIST_LIMIT).lean();
  const items: CommunityDTO[] = rows.map((c) =>
    toCommunityDTO(c, (roles.get(c._id.toString()) as "owner" | "member" | undefined) ?? null),
  );
  res.json(items);
}

export async function get(req: Request, res: Response) {
  const community = await findBySlug(req.params.slug);
  const membership = await Membership.findOne({ user: req.userId, community: community._id })
    .select("role")
    .lean();
  res.json(toCommunityDTO(community, membership?.role ?? null));
}

export async function join(req: Request, res: Response) {
  const community = await findBySlug(req.params.slug);
  try {
    await Membership.create({ user: req.userId, community: community._id, role: "member" });
    await Community.updateOne({ _id: community._id }, { $inc: { memberCount: 1 } });
  } catch (err) {
    // Already a member (a double click): treat as success.
    if (!isDuplicate(err)) throw err;
  }
  res.status(204).end();
}

export async function leave(req: Request, res: Response) {
  const community = await findBySlug(req.params.slug);
  const existing = await Membership.findOne({ user: req.userId, community: community._id })
    .select("role")
    .lean();
  if (existing?.role === "owner") throw badRequest("Owners can't leave their own community");
  const removed = await Membership.findOneAndDelete({ user: req.userId, community: community._id });
  if (removed) await Community.updateOne({ _id: community._id }, { $inc: { memberCount: -1 } });
  res.status(204).end();
}

export async function posts(req: Request, res: Response) {
  const community = await findBySlug(req.params.slug);
  await sendPostPage(req, res, { community: community._id });
}
