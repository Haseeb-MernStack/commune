import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { dismissToast, showToast, useToasts } from "./toast";

/** Renders just the titles of the toasts currently in the store. */
function ToastTitles() {
  const toasts = useToasts();
  return (
    <ul>
      {toasts.map((t) => (
        <li key={t.id}>{t.title}</li>
      ))}
    </ul>
  );
}

describe("showToast", () => {
  const shown: number[] = [];

  afterEach(() => {
    for (const id of shown) dismissToast(id);
    shown.length = 0;
  });

  it("shows a Saved banner that links to the Saved page", () => {
    shown.push(
      showToast({ title: "Saved", body: "Find it on your Saved page.", to: "/saved" }),
    );
    render(<ToastTitles />);
    expect(screen.queryByText("Saved")).not.toBeNull();
  });

  it("replaces the Saved banner with the Removed banner when both link to /saved", () => {
    shown.push(
      showToast({ title: "Saved", body: "Find it on your Saved page.", to: "/saved" }),
    );
    shown.push(
      showToast({
        title: "Removed from saved",
        body: "It is no longer on your Saved page.",
        to: "/saved",
      }),
    );
    render(<ToastTitles />);
    expect(screen.queryByText("Saved")).toBeNull();
    expect(screen.queryByText("Removed from saved")).not.toBeNull();
  });

  it("keeps a banner that links elsewhere", () => {
    shown.push(
      showToast({ title: "Saved", body: "Find it on your Saved page.", to: "/saved" }),
    );
    shown.push(
      showToast({
        title: "Link copied",
        body: "Share this post with anyone.",
        to: "/posts/1",
      }),
    );
    render(<ToastTitles />);
    expect(screen.queryByText("Saved")).not.toBeNull();
    expect(screen.queryByText("Link copied")).not.toBeNull();
  });
});
