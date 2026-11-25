import { MemoryRouter } from "react-router-dom";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import Toasts from "./Toasts";
import { dismissToast, showToast } from "../lib/toast";

const shown: number[] = [];
function show(input: Parameters<typeof showToast>[0]) {
  act(() => {
    shown.push(showToast(input));
  });
}

function renderToasts() {
  return render(
    <MemoryRouter>
      <Toasts />
    </MemoryRouter>,
  );
}

describe("Toasts", () => {
  afterEach(() => {
    act(() => shown.splice(0).forEach(dismissToast));
  });

  it("announces an action toast and focuses its button when nothing else has focus", () => {
    renderToasts();
    const undo = vi.fn();
    show({
      title: "Post deleted",
      body: "You can undo this.",
      action: { label: "Undo", onClick: undo },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Post deleted");
    expect(screen.getByRole("button", { name: "Undo" })).toHaveFocus();
  });

  it("runs the action from the keyboard and closes the toast", async () => {
    renderToasts();
    const undo = vi.fn();
    show({
      title: "Post deleted",
      body: "You can undo this.",
      action: { label: "Undo", onClick: undo },
    });

    await userEvent.keyboard("{Enter}");

    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Post deleted")).toBeNull();
  });

  it("does not take focus away from a control that still has it", () => {
    renderToasts();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();

    show({
      title: "Post deleted",
      body: "You can undo this.",
      action: { label: "Undo", onClick: vi.fn() },
    });

    expect(input).toHaveFocus();
    input.remove();
  });

  it("still links a toast that has a page to open", () => {
    renderToasts();
    show({ title: "New message", body: "Hi", to: "/messages/a" });

    expect(screen.getByRole("link", { name: /New message/ })).toHaveAttribute(
      "href",
      "/messages/a",
    );
  });
});
