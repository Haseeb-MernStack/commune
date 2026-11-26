import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PostImage from "./PostImage";

const author = { id: "u1", username: "sam", avatarUrl: null, plus: false };
const imageUrl = "/uploads/0123456789abcdef0123456789abcdef.jpg";

describe("PostImage", () => {
  it("reserves the image's own shape when its size is known", () => {
    render(<PostImage post={{ author, imageUrl, imageWidth: 1600, imageHeight: 900 }} />);
    const img = screen.getByRole("img", { name: "Image posted by @sam" });

    expect(img).toHaveAttribute("width", "1600");
    expect(img).toHaveAttribute("height", "900");
    expect(img.style.aspectRatio).toBe("1600 / 900");
    expect(img).not.toHaveClass("post-image-unsized");
  });

  it("gives an older post without a size a 4:3 box", () => {
    render(<PostImage post={{ author, imageUrl, imageWidth: null, imageHeight: null }} />);
    const img = screen.getByRole("img");

    expect(img).toHaveClass("post-image", "post-image-unsized");
    expect(img).not.toHaveAttribute("width");
    expect(img.style.aspectRatio).toBe("");
  });

  it("treats a missing size field the same as no size", () => {
    render(<PostImage post={{ author, imageUrl }} />);
    expect(screen.getByRole("img")).toHaveClass("post-image-unsized");
  });

  it("marks the image loaded so it can fade in over the placeholder", () => {
    render(<PostImage post={{ author, imageUrl, imageWidth: 4, imageHeight: 3 }} />);
    const img = screen.getByRole("img");

    expect(img).not.toHaveClass("is-loaded");
    fireEvent.load(img);
    expect(img).toHaveClass("is-loaded");
  });

  it("renders nothing for a post without an image", () => {
    const { container } = render(<PostImage post={{ author, imageUrl: null }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
