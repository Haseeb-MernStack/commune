import mongoose from "mongoose";
import type { Types } from "mongoose";
import type { EarningsDTO } from "@commune/shared";
import { env } from "../config/env.js";
import { Purchase } from "../models/Purchase.js";
import { User } from "../models/User.js";
import { isPlusActive } from "../utils/plan.js";

interface PostLike {
  _id: Types.ObjectId;
  author: { _id: Types.ObjectId };
  priceCents?: number | null;
}

/** Ids of the paid posts this viewer may read in full: their own, or ones they bought. */
export async function unlockedPostIds(userId: string, posts: PostLike[]): Promise<Set<string>> {
  const paid = posts.filter((p) => p.priceCents != null);
  const unlocked = new Set(
    paid.filter((p) => p.author._id.toString() === userId).map((p) => p._id.toString()),
  );
  const toCheck = paid.filter((p) => !unlocked.has(p._id.toString()));
  if (toCheck.length > 0) {
    const bought = await Purchase.find({ user: userId, post: { $in: toCheck.map((p) => p._id) } })
      .select("post")
      .lean();
    for (const b of bought) unlocked.add(b.post.toString());
  }
  return unlocked;
}

/** Splits a sale into the platform fee and the creator's share (rounded in the creator's favour). */
export function splitSale(amountCents: number, feePercent = env.PLATFORM_FEE_PERCENT) {
  const feeCents = Math.floor((amountCents * feePercent) / 100);
  return { feeCents, creatorShareCents: amountCents - feeCents };
}

export interface SaleInput {
  userId: string;
  postId: string;
  creatorId: string;
  amountCents: number;
  currency: string;
  provider: "lemonsqueezy" | "mock";
  orderId: string;
}

/** Records a purchase. Returns false if this order (or buyer + post) was already recorded. */
export async function recordPurchase(sale: SaleInput): Promise<boolean> {
  // Plus members keep more of each sale. The rate is fixed at the moment of the sale.
  const creator = await User.findById(sale.creatorId).select("plusUntil").lean();
  const feePercent = isPlusActive(creator?.plusUntil) ? env.PLUS_FEE_PERCENT : env.PLATFORM_FEE_PERCENT;
  try {
    await Purchase.create({
      user: sale.userId,
      post: sale.postId,
      creator: sale.creatorId,
      amountCents: sale.amountCents,
      ...splitSale(sale.amountCents, feePercent),
      currency: sale.currency,
      provider: sale.provider,
      providerOrderId: sale.orderId,
    });
    return true;
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false;
    throw err;
  }
}

export async function earningsFor(creatorId: string): Promise<EarningsDTO> {
  const [row] = await Purchase.aggregate<{
    sales: number;
    grossCents: number;
    feeCents: number;
    netCents: number;
  }>([
    { $match: { creator: new mongoose.Types.ObjectId(creatorId) } },
    {
      $group: {
        _id: null,
        sales: { $sum: 1 },
        grossCents: { $sum: "$amountCents" },
        feeCents: { $sum: "$feeCents" },
        netCents: { $sum: "$creatorShareCents" },
      },
    },
  ]);
  return {
    currency: "USD",
    sales: row?.sales ?? 0,
    grossCents: row?.grossCents ?? 0,
    feeCents: row?.feeCents ?? 0,
    netCents: row?.netCents ?? 0,
  };
}
