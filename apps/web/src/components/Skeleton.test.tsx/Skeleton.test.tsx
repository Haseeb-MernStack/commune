import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostListSkeleton, PostSkeleton } from "./Skeleton";

describe("PostSkeleton", () => {
  it("mirrors the new post card", () => {
    render(<PostSkeleton index={0} />);
    const post = document.querySelector(".sk-post") as HTMLElement;
    expect(post).not.toBeNull();
    const head = post.querySelector(".ig-head") as HTMLElement;
    expect(head).not.toBeNull();
    const avatar = head.querySelector(".sk-circle") as HTMLElement;
    expect(avatar.style.width).toBe("40px");
    expect(head.querySelector(".ig-who .sk-line.tall")).not.toBeNull();
    const dots = head.querySelector(".sk-action .sk-circle") as HTMLElement;
    expect(dots.style.width).toBe("24px");
    const bar = post.querySelector(".ig-bar") as HTMLElement;
    expect(bar).not.toBeNull();
    const left = bar.querySelectorAll(".ig-bar-left .sk-action .sk-circle");
    expect(left.length).toBe(3);
    expect((left[0] as HTMLElement).style.width).toBe("25px");
    expect((left[1] as HTMLElement).style.width).toBe("25px");
    expect((left[2] as HTMLElement).style.width).toBe("25px");
    const save = bar.querySelector(
      ":scope > .sk-action .sk-circle",
    ) as HTMLElement;
    expect(save.style.width).toBe("25px");
    expect(post.querySelector(".sk-image")).toBeNull();
  });

  it("shows an image placeholder for every third skeleton", () => {
    render(<PostSkeleton index={1} />);
    expect(document.querySelector(".sk-image")).not.toBeNull();
  });

  it("renders three skeleton posts with one loading message", () => {
    render(<PostListSkeleton />);
    expect(screen.getByText("Loading posts")).toBeInTheDocument();
    expect(document.querySelectorAll(".sk-post").length).toBe(3);
  });
});
