import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthForm from "./AuthForm";

const h = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  loginWithGoogle: vi.fn(),
  navigate: vi.fn(),
  user: null as unknown,
}));

// The form's only dependency on the API is through useAuth, so that is what we replace.
vi.mock("../store/auth", () => ({
  useAuth: () => ({
    user: h.user,
    login: h.login,
    register: h.register,
    loginWithGoogle: h.loginWithGoogle,
  }),
}));
vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));
// No Google script should load in tests.
vi.mock("./GoogleButton", () => ({ default: () => null, GOOGLE_CLIENT_ID: undefined }));

type Entry = string | { pathname: string; state?: unknown };

function renderForm(mode: "login" | "register", entry: Entry = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="*" element={<AuthForm mode={mode} />} />
      </Routes>
    </MemoryRouter>,
  );
}

const ui = {
  username: () => screen.getByLabelText(/^username/i),
  email: () => screen.getByLabelText(/^email/i),
  // The label also wraps the Show/Hide button, so ask for the input explicitly.
  password: () => screen.getByLabelText(/^password/i, { selector: "input" }),
  submit: (name: string) => screen.getByRole("button", { name }),
};

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  h.user = null;
});

describe("AuthForm in log-in mode", () => {
  it("shows the log-in fields and links, and no username field", () => {
    renderForm("login", "/login");
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(ui.email()).toBeInTheDocument();
    expect(ui.password()).toBeInTheDocument();
    expect(screen.queryByLabelText(/^username/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/register",
    );
  });

  it("does not show the consent line", () => {
    renderForm("login", "/login");
    expect(screen.queryByText(/you agree to the/i)).not.toBeInTheDocument();
  });

  it("rejects an empty form with an announced error and does not call login", async () => {
    const user = userEvent.setup();
    renderForm("login", "/login");
    await user.click(ui.submit("Log in"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/email/i);
    expect(h.login).not.toHaveBeenCalled();
  });

  it("rejects an email address that is not valid", async () => {
    const user = userEvent.setup();
    renderForm("login", "/login");
    await user.type(ui.email(), "sam@example");
    await user.type(ui.password(), "whatever1");
    await user.click(ui.submit("Log in"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/email/i);
    expect(h.login).not.toHaveBeenCalled();
  });

  it("sends normalised credentials and goes to the home page", async () => {
    h.login.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm("login", "/login");
    await user.type(ui.email(), "Sam@Example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Log in"));
    expect(h.login).toHaveBeenCalledWith({ email: "sam@example.com", password: "correct-horse" });
    expect(h.navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("shows a busy state while the request is running", async () => {
    const pending = deferred();
    h.login.mockReturnValue(pending.promise);
    const user = userEvent.setup();
    renderForm("login", "/login");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Log in"));

    const busy = await screen.findByRole("button", { name: "Please wait…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    pending.resolve();
    expect(await screen.findByRole("button", { name: "Log in" })).toBeEnabled();
  });

  it("shows and announces the error from a failed request, then lets the user retry", async () => {
    h.login.mockRejectedValue(new Error("Invalid email or password"));
    const user = userEvent.setup();
    renderForm("login", "/login");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "wrong-password");
    await user.click(ui.submit("Log in"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(h.navigate).not.toHaveBeenCalled();
    expect(ui.submit("Log in")).toBeEnabled();
  });

  it("falls back to a generic message when the failure has no message", async () => {
    h.login.mockRejectedValue("boom");
    const user = userEvent.setup();
    renderForm("login", "/login");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Log in"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("reveals and hides the password", async () => {
    const user = userEvent.setup();
    renderForm("login", "/login");
    expect(ui.password()).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(ui.password()).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(ui.password()).toHaveAttribute("type", "password");
  });

  it("shows the notice passed from the reset-password page", () => {
    renderForm("login", {
      pathname: "/login",
      state: { notice: "Password updated. Log in with it." },
    });
    expect(screen.getByRole("status")).toHaveTextContent("Password updated. Log in with it.");
  });

  it("redirects a signed-in visitor to the home page", () => {
    h.user = { id: "u1", username: "sam" };
    renderForm("login", "/login");
    expect(screen.getByText("Home page")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome back" })).not.toBeInTheDocument();
  });
});

describe("AuthForm in register mode", () => {
  it("shows the username field and the password hint", () => {
    renderForm("register", "/register");
    expect(screen.getByRole("heading", { name: "Join Commune" })).toBeInTheDocument();
    expect(ui.username()).toBeInTheDocument();
    expect(screen.getByText("At least 8 characters.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });

  it("shows the consent line with working Terms and Privacy links", () => {
    renderForm("register", "/register");
    expect(screen.getByText(/you agree to the/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });

  it("rejects a username that is too short", async () => {
    const user = userEvent.setup();
    renderForm("register", "/register");
    await user.type(ui.username(), "ab");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Create account"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/3 characters/);
    expect(h.register).not.toHaveBeenCalled();
  });

  it("rejects a username with spaces or symbols", async () => {
    const user = userEvent.setup();
    renderForm("register", "/register");
    await user.type(ui.username(), "no spaces!");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Create account"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Letters, numbers and underscores only",
    );
    expect(h.register).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 8 characters", async () => {
    const user = userEvent.setup();
    renderForm("register", "/register");
    await user.type(ui.username(), "sam_dev");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "short");
    await user.click(ui.submit("Create account"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/8 characters/);
    expect(h.register).not.toHaveBeenCalled();
  });

  it("registers with the typed details and goes to the home page", async () => {
    h.register.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForm("register", "/register");
    await user.type(ui.username(), "sam_dev");
    await user.type(ui.email(), "Sam@Example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Create account"));
    expect(h.register).toHaveBeenCalledWith({
      username: "sam_dev",
      email: "sam@example.com",
      password: "correct-horse",
    });
    expect(h.navigate).toHaveBeenCalledWith("/", { replace: true });
  });

  it("announces a server error such as a taken username", async () => {
    h.register.mockRejectedValue(new Error("Email or username is already taken"));
    const user = userEvent.setup();
    renderForm("register", "/register");
    await user.type(ui.username(), "sam_dev");
    await user.type(ui.email(), "sam@example.com");
    await user.type(ui.password(), "correct-horse");
    await user.click(ui.submit("Create account"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or username is already taken",
    );
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
