import { createRequire } from "module";
const require = createRequire("/home/user/Stablesaver/apps/web/package.json");
let pw; try { pw = require("playwright-core"); } catch { pw = require("playwright"); }
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.setItem("stablesave:onboarded:v1", "1"));
const page = await ctx.newPage();
await page.goto("http://localhost:3200/?amount=1000&asset=USDC", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "survey-home.png", fullPage: true });
console.log(await page.evaluate(() => document.body.scrollHeight));
await page.goto("http://localhost:3200/vault", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: "survey-vault.png", fullPage: true });
await browser.close();
