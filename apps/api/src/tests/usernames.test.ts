import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { registerSchema, usernameSchema } from "@commune/shared";
import { handle, toPostDTO, type PopulatedPost } from "../utils/serializers.js";

describe("usernameSchema", () => {
  it("turns capital letters into lowercase instead of rejecting them", () => {
    expect(usernameSchema.parse("Sam_Dev")).toBe("sam_dev");
    expect(usernameSchema.parse("  HASEEB  ")).toBe("haseeb");
  });

  it("still accepts plain lowercase names, digits and underscores", () => {
    expect(usernameSchema.parse("sam_dev_99")).toBe("sam_dev_99");
  });

  it("rejects names that are too short, too long, or have spaces or symbols", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
    expect(usernameSchema.safeParse("a".repeat(25)).success).toBe(false);
    expect(usernameSchema.safeParse("no spaces").success).toBe(false);
    expect(usernameSchema.safeParse("sam-dev").success).toBe(false);
    expect(usernameSchema.safeParse("sam.dev").success).toBe(false);
    expect(usernameSchema.safeParse("sámdev").success).toBe(false);
  });

  it("lowercases the username when someone registers", () => {
    const parsed = registerSchema.parse({
      username: "Sam_Dev",
      email: "Sam@Example.com",
      password: "correct-horse",
    });
    expect(parsed.username).toBe("sam_dev");
    expect(parsed.email).toBe("sam@example.com");
  });
});

describe("handle", () => {
  it("shows a name saved before the rule in lowercase", () => {
    expect(handle("SamRivers")).toBe("samrivers");
    expect(handle("already_lower")).toBe("already_lower");
  });

  it("is used for the author of a post", () => {
    const post = {
      _id: new mongoose.Types.ObjectId(),
      content: "hello",
      imageUrl: null,
      priceCents: null,
      premiumContent: null,
      community: null,
      author: {
        _id: new mongoose.Types.ObjectId(),
        username: "SamRivers",
        avatarUrl: null,
        plusUntil: null,
      },
      likeCount: 0,
      commentCount: 0,
      editedAt: null,
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
    } as PopulatedPost;
    expect(toPostDTO(post, false, false).author.username).toBe("samrivers");
  });
});
