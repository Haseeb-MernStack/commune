import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// A returning visitor has already answered the cookie notice, so it never
// appears over the pages below (same as smoke.spec.ts).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("commune-consent", "essential");
    } catch {
      /* storage unavailable */
    }
  });
});

// The pages axe checks on every run. There is no standalone 404 page:
// unknown paths redirect to "/", so the "404" entry checks the page that
// redirect lands on. No axe rule is disabled.
const pages = [
  { path: "/", name: "home", title: /Commune/i },
  { path: "/login", name: "sign-in", title: /Log in/ },
  { path: "/explore", name: "explore", title: /Explore/ },
  { path: "/no-such-page", name: "404", title: /Commune/i },
];

for (const { path, name, title } of pages) {
  test(`no serious or critical axe violations on ${name}`, async ({ page }) => {
    await page.goto(path);
    // The title proves the page (or, for the 404, the redirect target)
    // rendered before axe looks at it.
    await expect(page).toHaveTitle(title);
    const results = await new AxeBuilder({ page }).analyze();
    // Only serious and critical violations fail the test. Minor and
    // moderate findings are reported by axe but do not block a change.
    const blocking = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(
      blocking,
      `${name} has serious or critical axe violations: ${JSON.stringify(blocking, null, 2)}`,
    ).toEqual([]);
  });
}
