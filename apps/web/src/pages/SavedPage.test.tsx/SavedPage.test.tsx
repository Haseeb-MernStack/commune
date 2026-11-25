import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SavedPage from "./SavedPage";
import type { useSaved } from "../hooks/useBookmarks";

vi.mock("../hooks/useBookmarks", () => ({
  useSaved: () =>
    ({
      data: { pages: [] },
      isSuccess: true,
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
    }) as unknown as ReturnType<typeof useSaved>,
}));

describe("SavedPage", () => {
  it("links to Explore when nothing is saved", () => {
    render(
      <MemoryRouter>
        <SavedPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByText(
        "Nothing saved yet. Tap the bookmark on a post to keep it here.",
      ),
    ).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Explore posts" });
    expect(link.getAttribute("href")).toBe("/explore");
  });
});
