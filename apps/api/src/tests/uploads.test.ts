import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPostSchema, updateProfileSchema, uploadUrlSchema } from "@commune/shared";
import { createApp } from "../app.js";
import { uploadDir } from "../services/uploadService.js";
import { detectImageType } from "../utils/images.js";
import { signAccessToken } from "../utils/tokens.js";
import { mockUser } from "./helpers.js";

const app = createApp();
const token = signAccessToken("507f1f77bcf86cd799439011");
const auth = { Authorization: `Bearer ${token}` };

// Minimal buffers that start with each format's real signature.
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const gif = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(32)]);
const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(16)]);

// requireActive looks the user up in the database; tests have none, so return an active user.
beforeEach(() => {
  mockUser({ role: "user", banned: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await fs.rm(uploadDir, { recursive: true, force: true });
});

describe("detectImageType", () => {
  it("recognizes png, jpeg, gif and webp by their signatures", () => {
    expect(detectImageType(png)).toBe("png");
    expect(detectImageType(jpg)).toBe("jpg");
    expect(detectImageType(gif)).toBe("gif");
    expect(detectImageType(webp)).toBe("webp");
  });

  it("rejects text, html, svg and empty buffers", () => {
    expect(detectImageType(Buffer.from("hello world"))).toBeNull();
    expect(detectImageType(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
    expect(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("POST /api/uploads", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/uploads").attach("file", png, "a.png");
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file is sent", async () => {
    const res = await request(app).post("/api/uploads").set(auth);
    expect(res.status).toBe(400);
  });

  it("rejects a non-image even if it is named .png", async () => {
    const res = await request(app)
      .post("/api/uploads")
      .set(auth)
      .attach("file", Buffer.from("not really an image"), {
        filename: "evil.png",
        contentType: "image/png",
      });
    expect(res.status).toBe(400);
  });

  it("rejects files over 4 MB", async () => {
    const big = Buffer.concat([png, Buffer.alloc(4 * 1024 * 1024)]);
    const res = await request(app).post("/api/uploads").set(auth).attach("file", big, "big.png");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/4 MB/);
  });

  it("stores a valid image under a random name and serves it back", async () => {
    const res = await request(app).post("/api/uploads").set(auth).attach("file", png, "photo.png");
    expect(res.status).toBe(201);
    expect(uploadUrlSchema.safeParse(res.body.url).success).toBe(true);
    // The client's filename is never used.
    expect(res.body.url).not.toContain("photo");

    const onDisk = await fs.stat(path.join(uploadDir, path.basename(res.body.url)));
    expect(onDisk.isFile()).toBe(true);

    const served = await request(app).get(res.body.url);
    expect(served.status).toBe(200);
    expect(served.headers["content-type"]).toMatch(/image\/png/);
    expect(served.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("cannot read files outside the upload folder", async () => {
    const res = await request(app).get("/uploads/..%2f..%2fpackage.json");
    expect(res.status).not.toBe(200);
  });
});

describe("shared schemas for images", () => {
  it("accepts only our own upload paths", () => {
    const good = `/uploads/${"a".repeat(32)}.png`;
    expect(uploadUrlSchema.safeParse(good).success).toBe(true);
    expect(uploadUrlSchema.safeParse("https://evil.example/x.png").success).toBe(false);
    expect(uploadUrlSchema.safeParse("/uploads/../secret.png").success).toBe(false);
    expect(uploadUrlSchema.safeParse(`/uploads/${"a".repeat(32)}.svg`).success).toBe(false);
  });

  it("allows an image-only post but rejects an empty one", () => {
    const imageUrl = `/uploads/${"b".repeat(32)}.jpg`;
    expect(createPostSchema.safeParse({ content: "", imageUrl }).success).toBe(true);
    expect(createPostSchema.safeParse({ content: "hi" }).success).toBe(true);
    expect(createPostSchema.safeParse({ content: "   " }).success).toBe(false);
  });

  it("lets a profile update send only an avatar, or null to remove it", () => {
    const avatarUrl = `/uploads/${"c".repeat(32)}.webp`;
    expect(updateProfileSchema.safeParse({ avatarUrl }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ avatarUrl: null }).success).toBe(true);
    expect(updateProfileSchema.safeParse({}).success).toBe(true);
  });
});
