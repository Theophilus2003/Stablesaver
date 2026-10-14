import { createRequire } from "module";
const require = createRequire("/home/user/Stablesaver/apps/web/package.json");
let pw; try { pw = require("playwright-core"); } catch { pw = require("playwright"); }
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("stablesave:onboarded:v1", "1"));
const page = await ctx.newPage();
for (const [name, url] of [["deposit", "/vault/deposit?amount=1000"], ["withdraw", "/vault/withdraw"]]) {
  await page.goto("http://localhost:3200" + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `survey-${name}.png`, fullPage: true });
}
await page.goto("http://localhost:3200/vault", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Preview the dashboard/ }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: "survey-dashboard.png", fullPage: true });
await page.goto("http://localhost:3200/?amount=100&asset=USDC", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("radio", { name: /Ethereum/ }).click();
await page.waitForTimeout(600);
await page.locator("#options").screenshot({ path: "survey-eth100.png" });
await browser.close();
