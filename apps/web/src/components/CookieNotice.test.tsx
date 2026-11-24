import { MemoryRouter } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CookieNotice from "./CookieNotice";
import { CONSENT_KEY, closeCookieSettings, openCookieSettings } from "../lib/consent";

function renderNotice() {
  return render(
    <MemoryRouter>
      <CookieNotice />
    </MemoryRouter>,
  );
}

const consentUpdate = (value: "granted" | "denied") => [
  "consent",
  "update",
  {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  },
];

describe("CookieNotice", () => {
  const gtag = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    gtag.mockReset();
    window.gtag = gtag;
  });

  afterEach(() => {
    act(() => closeCookieSettings());
    delete window.gtag;
  });

  it("asks once, then stays hidden after reload", async () => {
    const first = renderNotice();
    await userEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(localStorage.getItem(CONSENT_KEY)).toBe("all");
    expect(gtag).toHaveBeenCalledWith(...consentUpdate("granted"));
    expect(screen.queryByRole("dialog", { name: "Cookies" })).toBeNull();

    first.unmount();
    renderNotice();
    expect(screen.queryByRole("dialog", { name: "Cookies" })).toBeNull();
  });

  it("reopens from Cookie settings with the current choice selected and focused", () => {
    localStorage.setItem(CONSENT_KEY, "essential");
    renderNotice();
    expect(screen.queryByRole("dialog", { name: "Cookies" })).toBeNull();

    act(() => openCookieSettings());
    const essential = screen.getByRole("button", { name: "Essential only" });
    expect(essential).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Accept all" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(essential).toHaveFocus();
  });

  it("withdrawing consent updates storage and analytics right away", async () => {
    localStorage.setItem(CONSENT_KEY, "all");
    renderNotice();

    act(() => openCookieSettings());
    // Keyboard only: focus starts on "Accept all", Tab moves to "Essential only".
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");

    expect(localStorage.getItem(CONSENT_KEY)).toBe("essential");
    expect(gtag).toHaveBeenCalledWith(...consentUpdate("denied"));
    expect(screen.queryByRole("dialog", { name: "Cookies" })).toBeNull();
  });

  it("closes with Escape without changing the choice", async () => {
    localStorage.setItem(CONSENT_KEY, "all");
    renderNotice();

    act(() => openCookieSettings());
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("dialog", { name: "Cookies" })).toBeNull();
    expect(localStorage.getItem(CONSENT_KEY)).toBe("all");
    expect(gtag).not.toHaveBeenCalled();
  });
});
