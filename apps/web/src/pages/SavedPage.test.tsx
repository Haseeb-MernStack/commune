import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SavedPage from "./SavedPage";

const mockUseSaved = vi.fn();

vi.mock("../hooks/useBookmarks", () => ({
  useSaved: () => mockUseSaved(),
}));

describe("SavedPage", () => {
  it("renders a friendly empty state with bookmark icon and Explore link when no posts are saved", () => {
    mockUseSaved.mockReturnValue({
      isLoading: false,
      isError: false,
      isSuccess: true,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: vi.fn(),
      data: { pages: [{ items: [] }], pageParams: [] },
    });

    render(
      <MemoryRouter>
        <SavedPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Saved" })).toBeTruthy();
    expect(screen.getByText("Nothing saved yet")).toBeTruthy();
    expect(screen.getByText("Tap the bookmark on a post to keep it here for later.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Browse Explore" });
    expect(link.getAttribute("href")).toBe("/explore");
  });
});
