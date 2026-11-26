import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { createPostSchema } from "@commune/shared";
import { toPostDTO, type PopulatedPost } from "../utils/serializers.js";

const POST_ID = "507f1f77bcf86cd799439012";
const AUTHOR_ID = "507f1f77bcf86cd799439011";
const CREATED_AT = new Date("2026-11-01T10:00:00.000Z");

/** A free, never-edited post; each test overrides only the fields it cares about. */
function makePost(overrides: Partial<PopulatedPost> = {}): PopulatedPost {
  return {
    _id: new mongoose.Types.ObjectId(POST_ID),
    content: "hello commune",
    imageUrl: null,
    priceCents: null,
    premiumContent: null,
    community: null,
    author: {
      _id: new mongoose.Types.ObjectId(AUTHOR_ID),
      username: "haseeb",
      avatarUrl: null,
      plusUntil: null,
    },
    likeCount: 3,
    commentCount: 2,
    editedAt: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

describe("toPostDTO edited flag", () => {
  it("returns editedAt null for a post that was never edited", () => {
    const dto = toPostDTO(makePost({ editedAt: null }), false, false);

    expect(dto.editedAt).toBeNull();
    expect(dto.createdAt).toBe(CREATED_AT.toISOString());
  });

  it("serialises editedAt as an ISO string when the post was edited", () => {
    const editedAt = new Date("2026-11-02T12:30:00.000Z");
    const dto = toPostDTO(makePost({ editedAt }), false, false);

    expect(dto.editedAt).toBe(editedAt.toISOString());
  });
});

describe("toPostDTO premium content", () => {
  it("hides premium content of a paid post from a viewer who has not unlocked it", () => {
    const dto = toPostDTO(
      makePost({ priceCents: 499, premiumContent: "the paid part" }),
      false,
      false,
    );

    expect(dto.priceCents).toBe(499);
    expect(dto.locked).toBe(true);
    expect(dto.premiumContent).toBeNull();
  });

  it("shows premium content of a paid post to a viewer who unlocked it", () => {
    const dto = toPostDTO(
      makePost({ priceCents: 499, premiumContent: "the paid part" }),
      false,
      true,
    );

    expect(dto.priceCents).toBe(499);
    expect(dto.locked).toBe(false);
    expect(dto.premiumContent).toBe("the paid part");
  });

  it("never locks a free post and gives it no premium content", () => {
    const dto = toPostDTO(makePost({ priceCents: null, premiumContent: null }), false, false);

    expect(dto.priceCents).toBeNull();
    expect(dto.locked).toBe(false);
    expect(dto.premiumContent).toBeNull();
  });
});

describe("toPostDTO image size", () => {
  const imageUrl = "/uploads/0123456789abcdef0123456789abcdef.jpg";

  it("returns the stored size with the image", () => {
    const dto = toPostDTO(makePost({ imageUrl, imageWidth: 1600, imageHeight: 900 }), false, false);

    expect(dto.imageWidth).toBe(1600);
    expect(dto.imageHeight).toBe(900);
  });

  it("returns null for an older post stored without a size", () => {
    const dto = toPostDTO(makePost({ imageUrl }), false, false);

    expect(dto.imageWidth).toBeNull();
    expect(dto.imageHeight).toBeNull();
  });

  it("never returns a size without an image", () => {
    const dto = toPostDTO(
      makePost({ imageUrl: null, imageWidth: 10, imageHeight: 10 }),
      false,
      false,
    );

    expect(dto.imageWidth).toBeNull();
    expect(dto.imageHeight).toBeNull();
  });
});

describe("createPostSchema image size", () => {
  const imageUrl = "/uploads/0123456789abcdef0123456789abcdef.jpg";

  it("accepts a positive whole-pixel size and keeps posts without one valid", () => {
    expect(
      createPostSchema.safeParse({ content: "", imageUrl, imageWidth: 1600, imageHeight: 900 })
        .success,
    ).toBe(true);
    expect(createPostSchema.safeParse({ content: "", imageUrl }).success).toBe(true);
  });

  it("rejects a size that is not a positive whole number of pixels", () => {
    for (const imageWidth of [0, -1, 1.5, 20001]) {
      expect(
        createPostSchema.safeParse({ content: "", imageUrl, imageWidth, imageHeight: 900 }).success,
      ).toBe(false);
    }
  });
});
