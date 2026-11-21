import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { describeViolation } from "../controllers/monitorController.js";

const app = createApp();

describe("describeViolation", () => {
  it("reads the classic csp-report format and strips paths and queries", () => {
    const found = describeViolation({
      "csp-report": {
        "effective-directive": "script-src-elem",
        "blocked-uri": "https://cdn.example.com/lib.js?token=secret",
        "document-uri": "https://commune-mu.vercel.app/posts/abc?x=1",
        disposition: "report",
      },
    });
    expect(found).toEqual({
      message: "script-src-elem would block https://cdn.example.com",
      route: "/posts/abc",
    });
    expect(JSON.stringify(found)).not.toContain("secret");
  });

  it("reads the Reporting API format", () => {
    const found = describeViolation([
      {
        type: "csp-violation",
        body: {
          effectiveDirective: "script-src-elem",
          blockedURL: "inline",
          documentURL: "https://commune-mu.vercel.app/",
          disposition: "enforce",
        },
      },
    ]);
    expect(found).toEqual({ message: "script-src-elem blocked inline", route: "/" });
  });

  it("ignores anything that is not a policy report", () => {
    expect(describeViolation(undefined)).toBeNull();
    expect(describeViolation({})).toBeNull();
    expect(describeViolation("nope")).toBeNull();
    expect(describeViolation({ "csp-report": {} })).toBeNull();
  });
});

describe("POST /api/csp-report", () => {
  it("accepts a report without logging in", async () => {
    const res = await request(app)
      .post("/api/csp-report")
      .set("Content-Type", "application/csp-report")
      .send(JSON.stringify({ "csp-report": { "effective-directive": "img-src" } }));
    expect(res.status).toBe(204);
  });

  it("answers 204 even for junk, and does not crash on an empty body", async () => {
    const junk = await request(app)
      .post("/api/csp-report")
      .set("Content-Type", "application/reports+json")
      .send("[1,2,3]");
    expect(junk.status).toBe(204);
    expect((await request(app).post("/api/csp-report")).status).toBe(204);
  });
});
