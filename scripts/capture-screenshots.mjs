/**
 * Captures the README's grading evidence by driving a real Chrome against the
 * running dev server, so every screenshot is reproducible rather than hand-taken.
 *
 *   npm run dev              # in one terminal
 *   npm run screenshots      # in another
 *
 * Credentials come from .env.local by name and are never logged. The two accounts
 * are the same throwaway fixtures tests/rls.integration.test.ts uses.
 */

import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import puppeteer from "puppeteer-core";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
// fileURLToPath, not .pathname — the repo path contains a space, which stays
// percent-encoded in a URL and produces an "AI%20Class" directory that does not exist.
const OUT = fileURLToPath(new URL("../docs/screenshots/", import.meta.url));
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const A = { email: process.env.TEST_USER_A_EMAIL, password: process.env.TEST_USER_A_PASSWORD };
const B = { email: process.env.TEST_USER_B_EMAIL, password: process.env.TEST_USER_B_PASSWORD };

if (!A.email || !A.password || !B.email || !B.password) {
  console.error("Needs TEST_USER_A/B_EMAIL and _PASSWORD in .env.local.");
  process.exit(1);
}

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
// Deliberately not `isMobile: true` — toggling that flag makes Chrome re-emulate the
// page and blows away the React state (chosen sort/filter) mid-capture.
const MOBILE = { width: 375, height: 812, deviceScaleFactor: 2 };

await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  defaultViewport: DESKTOP,
  args: ["--hide-scrollbars"],
});

/** Screenshots go to docs/screenshots/<name>.png. */
async function shot(page, name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log(`captured ${name}.png`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Types into a React-controlled input so onChange actually fires. */
async function fill(page, selector, value) {
  await page.waitForSelector(selector);
  await page.click(selector, { clickCount: 3 });
  await page.type(selector, value);
}

async function signIn(page, { email, password }) {
  await page.goto(`${APP_URL}/sign-in`, { waitUntil: "networkidle0" });
  await fill(page, "#email", email);
  await fill(page, "#password", password);
  await Promise.all([
    page.waitForFunction(() => location.pathname === "/contacts", { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  // Wait for a *positive* terminal state, not merely the absence of the spinner.
  // "no loading text" is vacuously true in the moment before React mounts the loading
  // state, which raced fine against localhost but captured a spinner against production.
  // User B legitimately has no contacts, so an empty state counts as settled too.
  await page.waitForFunction(
    () => {
      const text = document.body.textContent;
      if (text.includes("Loading your contacts")) return false;
      return Boolean(document.querySelector("table")) || text.includes("No contacts");
    },
    { timeout: 30000 },
  );
  await sleep(600);
}

async function signOut(page) {
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find(
      (element) => element.textContent.trim() === "Sign out",
    );
    button?.click();
  });
  await page.waitForFunction(() => location.pathname === "/sign-in", { timeout: 20000 });
  await sleep(400);
}

const page = await browser.newPage();

// 1. Signed-out sign-in screen.
await page.goto(`${APP_URL}/sign-in`, { waitUntil: "networkidle0" });
await shot(page, "01-sign-in");

// 2. User A's populated list on desktop.
await signIn(page, A);
await shot(page, "02-contacts-desktop");

// 3. The create/edit dialog.
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find(
    (element) => element.textContent.trim() === "Add contact",
  );
  button?.click();
});
await page.waitForSelector("dialog[open]");
await sleep(300);
await shot(page, "03-add-contact-dialog");

// 4. Invalid input rejected by the server, not the browser.
await page.evaluate(() => {
  const submit = [...document.querySelectorAll("dialog button")].find(
    (element) => element.type === "submit",
  );
  submit?.click();
});
await page.waitForSelector("dialog [role='alert'], dialog p", { timeout: 10000 });
await sleep(600);
await shot(page, "04-validation-error");
await page.keyboard.press("Escape");
await sleep(300);

// 5. Sorting and filtering.
await page.evaluate(() => {
  const header = [...document.querySelectorAll("th button")].find((element) =>
    element.textContent.includes("Priority"),
  );
  header?.click();
});
await sleep(900);
await shot(page, "05-sorted-by-priority");

// 6. Mobile card layout.
await page.setViewport(MOBILE);
await sleep(700);
await shot(page, "06-contacts-mobile");
await page.setViewport(DESKTOP);
await sleep(500);

// 7. The privacy proof: User B signs in and sees none of User A's contacts.
await signOut(page);
await signIn(page, B);
await shot(page, "07-user-b-sees-nothing");

await browser.close();
console.log(`\nAll screenshots written to docs/screenshots/`);
