import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadUrlSchema } from "@commune/shared";

// Cloud storage must be configured before the config module is first imported.
vi.hoisted(() => {
  process.env.CLOUDINARY_CLOUD_NAME = "democloud";
  process.env.CLOUDINARY_API_KEY = "key123";
  process.env.CLOUDINARY_API_SECRET = "secret456";
});

import { createApp } from "../app.js";
import { cloudinarySignature } from "../services/uploadService.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();
const auth = { Authorization: `Bearer ${signAccessToken("507f1f77bcf86cd799439011")}` };

afterEach(() => vi.unstubAllGlobals());

describe("POST /api/uploads/sign", () => {
  it("requires a login", async () => {
    expect((await request(app).post("/api/uploads/sign")).status).toBe(401);
  });

  it("hands out a signed ticket for one random file", async () => {
    const res = await request(app).post("/api/uploads/sign").set(auth);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    const t = res.body;
    expect(t.mode).toBe("direct");
    expect(t.uploadUrl).toBe("https://api.cloudinary.com/v1_1/democloud/image/upload");
    expect(t.apiKey).toBe("key123");
    expect(t.publicId).toMatch(/^commune\/[a-f0-9]{32}$/);
    // The secret itself is never sent, only a signature made with it.
    expect(JSON.stringify(t)).not.toContain("secret456");
    expect(t.signature).toBe(
      cloudinarySignature(
        { allowed_formats: t.allowedFormats, public_id: t.publicId, timestamp: t.timestamp },
        "secret456",
      ),
    );
  });

  it("gives every upload its own name", async () => {
    const a = await request(app).post("/api/uploads/sign").set(auth);
    const b = await request(app).post("/api/uploads/sign").set(auth);
    expect(a.body.publicId).not.toBe(b.body.publicId);
  });
});

describe("POST /api/uploads/complete", () => {
  const id = "a".repeat(32);

  it("requires a login", async () => {
    expect((await request(app).post("/api/uploads/complete").send({ id, format: "png" })).status).toBe(401);
  });

  it("rejects malformed ids and formats", async () => {
    const bad = (body: object) => request(app).post("/api/uploads/complete").set(auth).send(body);
    expect((await bad({ id: "../etc/passwd", format: "png" })).status).toBe(400);
    expect((await bad({ id, format: "svg" })).status).toBe(400);
    expect((await bad({ format: "png" })).status).toBe(400);
  });

  it("returns the stored reference once the file exists in storage", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await request(app).post("/api/uploads/complete").set(auth).send({ id, format: "jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.url).toBe(`/uploads/${id}.jpg`);
    expect(uploadUrlSchema.safeParse(res.body.url).success).toBe(true);
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      `https://res.cloudinary.com/democloud/image/upload/commune/${id}`,
    );
  });

  it("refuses files that are not in storage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    const res = await request(app).post("/api/uploads/complete").set(auth).send({ id, format: "png" });
    expect(res.status).toBe(400);
  });

  it("refuses when storage cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const res = await request(app).post("/api/uploads/complete").set(auth).send({ id, format: "png" });
    expect(res.status).toBe(400);
  });
});
