import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

// Switch the app into Cloudinary mode before anything imports the config.
vi.hoisted(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "democloud";
  process.env.CLOUDINARY_API_KEY = "key123";
  process.env.CLOUDINARY_API_SECRET = "secret456";
});

import { createApp } from "../app.js";
import { cloudinarySignature, uploadDir, usesCloudStorage } from "../services/uploadService.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const auth = { Authorization: `Bearer ${signAccessToken("507f1f77bcf86cd799439011")}` };
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);
const ID = "a".repeat(32);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cloud storage mode", () => {
  it("is enabled when the three Cloudinary variables are set", () => {
    expect(usesCloudStorage).toBe(true);
  });
});

describe("cloudinarySignature", () => {
  it("sorts parameters alphabetically and appends the secret before hashing", () => {
    const expected = crypto
      .createHash("sha1")
      .update("public_id=commune/abc&timestamp=1700000000" + "secret456")
      .digest("hex");
    // Passed in the "wrong" order on purpose.
    expect(
      cloudinarySignature({ timestamp: "1700000000", public_id: "commune/abc" }, "secret456"),
    ).toBe(expected);
  });
});

describe("GET /uploads/:file in cloud mode", () => {
  it("redirects to the optimized Cloudinary URL with long-lived caching", async () => {
    const res = await request(app).get(`/uploads/${ID}.png`).redirects(0);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      `https://res.cloudinary.com/democloud/image/upload/f_auto,q_auto/commune/${ID}`,
    );
    expect(res.headers["cache-control"]).toMatch(/immutable/);
  });

  it("returns 404 for names that are not our upload references", async () => {
    for (const bad of ["secret.png", "..%2fetc%2fpasswd", `${ID}.svg`]) {
      const res = await request(app).get(`/uploads/${bad}`).redirects(0);
      expect(res.status).toBe(404);
    }
  });
});

describe("POST /api/uploads in cloud mode", () => {
  it("sends a signed upload to Cloudinary and keeps nothing on local disk", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post("/api/uploads").set(auth).attach("file", png, "a.png");
    expect(res.status).toBe(201);
    expect(res.body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: FormData }];
    expect(url).toBe("https://api.cloudinary.com/v1_1/democloud/image/upload");
    expect(init.method).toBe("POST");

    const id = path.basename(res.body.url, ".png");
    const publicId = init.body.get("public_id");
    const timestamp = init.body.get("timestamp");
    expect(publicId).toBe(`commune/${id}`);
    expect(init.body.get("api_key")).toBe("key123");
    expect(init.body.get("signature")).toBe(
      cloudinarySignature(
        { public_id: String(publicId), timestamp: String(timestamp) },
        "secret456",
      ),
    );
    // The secret itself is never sent.
    expect(JSON.stringify([...init.body.keys()])).not.toContain("secret");

    await expect(fs.stat(path.join(uploadDir, `${id}.png`))).rejects.toThrow();
  });

  it("returns 502 when Cloudinary rejects the upload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" }),
    );
    const res = await request(app).post("/api/uploads").set(auth).attach("file", png, "a.png");
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  it("still rejects non-images before contacting Cloudinary", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await request(app)
      .post("/api/uploads")
      .set(auth)
      .attach("file", Buffer.from("not an image"), "x.png");
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
