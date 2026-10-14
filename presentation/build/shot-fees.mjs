import { createRequire } from "module";
const require = createRequire("/home/user/Stablesaver/apps/web/package.json");
let pw; try { pw = require("playwright-core"); } catch { pw = require("playwright"); }
const out = "/home/user/Stablesaver/presentation/assets/screens";
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem("stablesave:onboarded:v1", "1"));
const page = await ctx.newPage();
await page.goto("http://localhost:3200/?amount=100&asset=USDC", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("radio", { name: /Ethereum/ }).click();
await page.waitForTimeout(700);
await page.locator("#options").screenshot({ path: `${out}/05-fees-ethereum-100.png` });
await browser.close();
console.log("ok");
