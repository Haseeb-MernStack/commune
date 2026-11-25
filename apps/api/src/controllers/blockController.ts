import type { Request, Response } from "express";
import type { BlockedUserDTO, BlockKind, SetBlockInput } from "@commune/shared";
import { Block } from "../models/Block.js";
import { Follow } from "../models/Follow.js";
import { badRequest } from "../utils/errors.js";
import { handle } from "../utils/serializers.js";
import { findByUsername } from "./userController.js";

/** PUT /users/:username/block  { kind: "mute" | "block" } */
export async function set(req: Request, res: Response) {
  const target = await findByUsername(req.params.username);
  const me = req.userId!;
  if (target._id.toString() === me) throw badRequest("You can't mute or block yourself");
  const { kind } = req.body as SetBlockInput;

  await Block.updateOne({ blocker: me, blocked: target._id }, { $set: { kind } }, { upsert: true });
  if (kind === "block") {
    // Blocking ends any following, in both directions.
    await Follow.deleteMany({
      $or: [
        { follower: me, following: target._id },
        { follower: target._id, following: me },
      ],
    });
  }
  res.status(204).end();
}

/** DELETE /users/:username/block: unmute or unblock. */
export async function remove(req: Request, res: Response) {
  const target = await findByUsername(req.params.username);
  await Block.deleteOne({ blocker: req.userId, blocked: target._id });
  res.status(204).end();
}

/** GET /users/me/blocks: everyone I have muted or blocked, newest first. */
export async function list(req: Request, res: Response) {
  const rows = (await Block.find({ blocker: req.userId })
    .sort({ _id: -1 })
    .limit(200)
    .populate("blocked", "username avatarUrl")
    .lean()) as unknown as Array<{
    kind: BlockKind;
    createdAt: Date;
    blocked: { _id: { toString(): string }; username: string; avatarUrl?: string | null } | null;
  }>;
  const body: BlockedUserDTO[] = rows.flatMap((r) =>
    r.blocked
      ? [
          {
            id: r.blocked._id.toString(),
            username: handle(r.blocked.username),
            avatarUrl: r.blocked.avatarUrl ?? null,
            kind: r.kind,
            createdAt: r.createdAt.toISOString(),
          },
        ]
      : [],
  );
  res.json(body);
}
