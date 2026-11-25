import { expect, test } from "@playwright/test";

// A short "does the product work" check: the API is up, a visitor can join, post, sign out and sign back in.
// Keep these few and stable. They run against the real API and a real browser.

const unique = Date.now().toString(36);
const user = {
  username: `e2e_${unique}`,
  email: `e2e_${unique}@example.com`,
  password: "E2e-Test-Pass-12345",
};

// A returning visitor has already answered the cookie notice. Without this the notice sits over the
// bottom of the page and these tests would depend on dismissing it.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("commune-consent", "essential");
    } catch {
      /* storage unavailable */
    }
  });
});

test("the API is healthy", async ({ request }) => {
  const res = await request.get("http://localhost:4000/api/health");
  expect(res.ok()).toBe(true);
});

test("a visitor sees the site and the sign-up link", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Commune/i);
  await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
});

test("join, post, sign out and sign back in", async ({ page }) => {
  await test.step("create an account", async () => {
    await page.goto("/register");
    await page.getByLabel("Username").fill(user.username);
    await page.getByLabel("Email").fill(user.email);
    await page.locator("input[autocomplete$=password]").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("textbox", { name: "Write a post" })).toBeVisible();
  });

  const composer = page.getByRole("textbox", { name: "Write a post" });
  const composerHeight = () => composer.evaluate((el) => el.getBoundingClientRect().height);
  const initialHeight = await composerHeight();

  await test.step("the composer grows with typed and pasted text, then shrinks", async () => {
    await composer.pressSequentially("First line");
    await composer.press("Enter");
    await composer.pressSequentially("Second line");
    await composer.press("Enter");
    await composer.pressSequentially("Third line");
    await expect.poll(composerHeight).toBeGreaterThan(initialHeight);
    await expect
      .poll(() => composer.evaluate((el) => el.scrollHeight <= el.clientHeight))
      .toBe(true);

    await composer.fill("");
    await expect.poll(composerHeight).toBe(initialHeight);

    const pasted = "One\nTwo\nThree\nFour";
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate((value) => navigator.clipboard.writeText(value), pasted);
    await composer.press("ControlOrMeta+V");
    await expect(composer).toHaveValue(pasted);
    await expect.poll(composerHeight).toBeGreaterThan(initialHeight);
    const max = await composer.getAttribute("maxlength");
    await expect(page.getByText(`${pasted.length}/${max}`, { exact: true })).toBeVisible();

    await composer.fill("Short draft");
    await expect.poll(composerHeight).toBe(initialHeight);
  });

  await test.step("the mobile composer stops growing and scrolls at the height limit", async () => {
    const desktop = page.viewportSize()!;
    const mobile = { width: 390, height: 844 };
    await composer.fill("A longer draft that wraps across the composer. ".repeat(4));
    const wideHeight = await composerHeight();
    await page.setViewportSize(mobile);
    await expect.poll(composerHeight).toBeGreaterThan(wideHeight);
    await composer.fill("");
    const mobileInitialHeight = await composerHeight();
    await composer.fill("Line\n".repeat(40));
    await expect.poll(composerHeight).toBeGreaterThan(mobileInitialHeight);
    await expect.poll(composerHeight).toBeGreaterThanOrEqual(mobile.height * 0.4 - 1);
    await expect.poll(composerHeight).toBeLessThanOrEqual(mobile.height * 0.4 + 1);
    await expect.poll(() => composer.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    await composer.fill("");
    await expect.poll(composerHeight).toBe(mobileInitialHeight);
    await page.setViewportSize(desktop);
  });

  const text = `Hello from the browser test ${unique}\nThis is a longer post.\nIt has three lines.`;
  await test.step("publish a post and see it in the feed", async () => {
    await composer.fill(text);
    await expect.poll(composerHeight).toBeGreaterThan(initialHeight);
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await expect(composer).toHaveValue("");
    await expect.poll(composerHeight).toBe(initialHeight);
    await expect(page.getByText(text).first()).toBeVisible();
  });

  await test.step("the post is still there after a reload (the session survives)", async () => {
    await page.reload();
    // First prove the session came back (the composer only shows for a signed-in user)...
    await expect(
      page.getByRole("textbox", { name: "Write a post" }),
      "after a reload the user should still be signed in (the refresh cookie must be sent)",
    ).toBeVisible();
    // ...then that the feed lists the post.
    await expect(page.getByText(text).first()).toBeVisible();
  });

  await test.step("sign out", async () => {
    await page.getByRole("button", { name: "Log out" }).first().click();
    await expect(page.getByRole("link", { name: "Sign up" }).first()).toBeVisible();
  });

  await test.step("sign back in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(user.email);
    await page.locator("input[autocomplete$=password]").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("textbox", { name: "Write a post" })).toBeVisible();
  });
});

test("the help page opens and its answers expand", async ({ page }) => {
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Help and FAQ", level: 1 })).toBeVisible();
  const first = page.locator("details.help-item").first();
  await first.locator("summary").click();
  await expect(first).toHaveAttribute("open", "");
});
