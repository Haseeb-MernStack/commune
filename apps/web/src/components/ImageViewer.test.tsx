import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ImageViewer from "./ImageViewer";

function renderViewer(onClose = vi.fn()) {
  render(<ImageViewer src="/uploads/a.jpg" alt="Post by @sam" caption="@sam" onClose={onClose} />);
  return onClose;
}

afterEach(() => {
  document.body.style.overflow = "";
});

describe("ImageViewer", () => {
  it("shows the picture and who posted it", () => {
    renderViewer();
    expect(screen.getByRole("img", { name: "Post by @sam" })).toHaveAttribute(
      "src",
      "/uploads/a.jpg",
    );
    expect(screen.getByText("@sam")).toBeInTheDocument();
  });

  it("closes with the close button", async () => {
    const onClose = renderViewer();
    await userEvent.click(screen.getByRole("button", { name: "Close image" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape", () => {
    const onClose = renderViewer();
    fireEvent(screen.getByLabelText("Post by @sam", { selector: "dialog" }), new Event("cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the dark area is clicked, but not when the picture is", async () => {
    const onClose = renderViewer();
    await userEvent.click(screen.getByRole("img", { name: "Post by @sam" }));
    expect(onClose).not.toHaveBeenCalled();
    const stage = document.querySelector(".viewer-stage") as HTMLElement;
    await userEvent.click(stage);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("zooms in and out when the picture is clicked", async () => {
    renderViewer();
    const img = screen.getByRole("img", { name: "Post by @sam" });
    expect(img).not.toHaveClass("is-zoomed");
    await userEvent.click(img);
    expect(img).toHaveClass("is-zoomed");
    await userEvent.click(img);
    expect(img).not.toHaveClass("is-zoomed");
  });

  it("stops the page behind from scrolling, and restores it on close", () => {
    document.body.style.overflow = "auto";
    const { unmount } = render(<ImageViewer src="/a.jpg" alt="x" onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).toBe("auto");
  });
});
