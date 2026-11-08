import { describe, expect, it, vi } from "vitest";
import { Membership } from "../membership.js";

const ID = "cccccccccccccccccccccccc";

describe("Membership", () => {
  it("asks the API with the shared secret and caches the answer", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ participants: ["a", "b"] }), { status: 200 }),
    );
    const m = new Membership("http://api.test", "secret", fetchMock as never);
    expect(await m.isMember(ID, "a")).toBe(true);
    expect(await m.isMember(ID, "z")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("treats an unknown conversation as no access", async () => {
    const m = new Membership(
      "http://api.test",
      "s",
      (async () => new Response("{}", { status: 404 })) as never,
    );
    expect(await m.isMember(ID, "a")).toBe(false);
  });

  it("fails closed and does not cache when the API is unreachable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("down");
    });
    const m = new Membership("http://api.test", "s", fetchMock as never);
    expect(await m.isMember(ID, "a")).toBe(false);
    expect(await m.isMember(ID, "a")).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
