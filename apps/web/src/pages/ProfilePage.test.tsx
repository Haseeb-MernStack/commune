import type { ProfileDTO, PublicUser } from "@commune/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Toasts from "../components/Toasts";
import { dismissToast } from "../lib/toast";
import ProfilePage from "./ProfilePage";

const mockUseAuth = vi.fn<() => { user: PublicUser | null }>();
const mockUseProfile = vi.fn();

const idleMutation = () => ({ mutate: vi.fn(), isPending: false, isError: false, error: null });

vi.mock("../store/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../hooks/useSocial", () => ({
  useProfile: (username: string) => mockUseProfile(username),
  useUserPosts: () => ({
    isLoading: false,
    isError: false,
    isSuccess: true,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    data: { pages: [{ items: [], nextCursor: null }], pageParams: [undefined] },
  }),
  useToggleFollow: () => idleMutation(),
  useUpdateProfile: () => idleMutation(),
}));

vi.mock("../hooks/useModeration", () => ({
  useBanUser: () => idleMutation(),
  useUnbanUser: () => idleMutation(),
}));

vi.mock("../hooks/useBlocks", () => ({
  useSetBlock: () => idleMutation(),
  useRemoveBlock: () => idleMutation(),
}));

vi.mock("../hooks/useProfilePhoto", () => ({
  useAvatarAllowance: () => ({ data: undefined }),
  useProfilePhoto: () => ({
    preview: null,
    error: null,
    busy: false,
    pick: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock("../components/EarningsCard", () => ({
  default: () => <div data-testid="earnings-card" />,
}));

vi.mock("../components/PostList", () => ({
  default: () => <div data-testid="post-list" />,
}));

function makeProfile(overrides: Partial<ProfileDTO> = {}): ProfileDTO {
  return {
    id: "user-2",
    username: "alice",
    bio: "Hello from Commune",
    avatarUrl: null,
    role: "user",
    plus: false,
    emailVerified: true,
    createdAt: "2025-01-15T00:00:00.000Z",
    postCount: 3,
    followerCount: 12,
    followingCount: 8,
    followedByMe: false,
    banned: false,
    connectionsHidden: false,
    blockKind: null,
    ...overrides,
  };
}

function renderProfile(username = "alice") {
  return render(
    <MemoryRouter initialEntries={[`/u/${username}`]}>
      <Routes>
        <Route
          path="/u/:username"
          element={
            <>
              <ProfilePage />
              <Toasts />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProfilePage Share button", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        username: "viewer",
        bio: "",
        avatarUrl: null,
        role: "user",
        plus: false,
        emailVerified: true,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    });
    mockUseProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeProfile(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      dismissToast(id);
    }
  });

  it("renders an accessible Share button next to Follow and Message", () => {
    renderProfile();

    const followButton = screen.getByRole("button", { name: "Follow" });
    const messageLink = screen.getByRole("link", { name: "Message" });
    const shareButton = screen.getByRole("button", { name: "Share @alice's profile" });

    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toHaveTextContent("Share");
    expect(followButton.compareDocumentPosition(messageLink)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(messageLink.compareDocumentPosition(shareButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("renders Share on the viewer's own profile as well", () => {
    mockUseProfile.mockReturnValue({
      isLoading: false,
      isError: false,
      data: makeProfile({ id: "user-1", username: "viewer" }),
    });

    renderProfile("viewer");

    expect(screen.getByRole("button", { name: "Edit profile" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share @viewer's profile" })).toBeInTheDocument();
  });

  it("uses navigator.share with /u/<username> and @username on Commune when available", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    renderProfile();
    await user.click(screen.getByRole("button", { name: "Share @alice's profile" }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({
      title: "@alice on Commune",
      url: `${window.location.origin}/u/alice`,
    });
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to copying the profile URL and showing a toast when navigator.share is unavailable", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    renderProfile();
    await user.click(screen.getByRole("button", { name: "Share @alice's profile" }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/u/alice`);
    expect(screen.getByRole("status")).toHaveTextContent("Link copied");
    expect(screen.getByRole("status")).toHaveTextContent("Share this profile with anyone.");
  });

  it("ignores AbortError silently when the share sheet is dismissed", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockRejectedValue(new DOMException("Canceled", "AbortError"));
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { share, clipboard: { writeText } });

    renderProfile();
    await user.click(screen.getByRole("button", { name: "Share @alice's profile" }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
