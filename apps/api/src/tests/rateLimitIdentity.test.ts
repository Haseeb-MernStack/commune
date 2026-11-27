import { describe, expect, it } from "vitest";
import { requestIdentity } from "../middleware/rateLimit.js";
import { signAccessToken } from "../utils/tokens.js";

const req = (authorization: string | undefined, ip = "203.0.113.7") => ({
  headers: authorization ? { authorization } : {},
  ip,
});

describe("requestIdentity", () => {
  it("counts a signed-in request against the account, not the address", () => {
    const token = signAccessToken("user-1");
    const a = requestIdentity(req(`Bearer ${token}`, "203.0.113.7"));
    const b = requestIdentity(req(`Bearer ${token}`, "198.51.100.9"));
    expect(a).toEqual({ key: "user:user-1", signedIn: true });
    expect(b.key).toBe(a.key);
  });

  it("gives two accounts behind one address separate allowances", () => {
    const one = requestIdentity(req(`Bearer ${signAccessToken("user-1")}`));
    const two = requestIdentity(req(`Bearer ${signAccessToken("user-2")}`));
    expect(one.key).not.toBe(two.key);
  });

  it("counts a visitor against the address", () => {
    expect(requestIdentity(req(undefined))).toEqual({ key: "ip:203.0.113.7", signedIn: false });
  });

  it("treats a forged or malformed token as a visitor", () => {
    expect(requestIdentity(req("Bearer not-a-real-token")).signedIn).toBe(false);
    expect(requestIdentity(req("Basic abc")).signedIn).toBe(false);
  });
});
