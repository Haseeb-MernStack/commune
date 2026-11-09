import { expect, test } from "@playwright/test";

// A short "does the product work" check: the API is up, a visitor can join, post, sign out and sign back in.
// Keep these few and stable. They run against the real API and a real browser.

const unique = Date.now().toString(36);
const user = {
  username: `e2e_${unique}`,
  email: `e2e_${unique}@example.com`,
  password: "E2e-Test-Pass-12345",
};

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
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("textbox", { name: "Write a post" })).toBeVisible();
  });

  const text = `Hello from the browser test ${unique}`;
  await test.step("publish a post and see it in the feed", async () => {
    await page.getByRole("textbox", { name: "Write a post" }).fill(text);
    await page.getByRole("button", { name: "Post", exact: true }).click();
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
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.getByRole("textbox", { name: "Write a post" })).toBeVisible();
  });
});
