import { afterEach, describe, expect, it, vi } from "vitest";

// The provider key must exist before the config module is first imported.
vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Commune <hello@example.com>";
});

import { sendMail } from "../services/mailService.js";

const mail = { to: "sam@example.com", subject: "Hi", text: "plain", html: "<p>html</p>" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendMail with Resend configured", () => {
  it("posts the message to the Resend API with the bearer key", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await sendMail(mail);

    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init.body)).toEqual({
      from: "Commune <hello@example.com>",
      to: ["sam@example.com"],
      subject: "Hi",
      text: "plain",
      html: "<p>html</p>",
    });
  });

  it("throws when the provider rejects the message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 403, text: async () => "domain not verified" }),
    );
    await expect(sendMail(mail)).rejects.toThrow(/403/);
  });
});
