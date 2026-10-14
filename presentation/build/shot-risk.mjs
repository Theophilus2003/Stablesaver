import { createRequire } from "module";
const require = createRequire("/home/user/Stablesaver/apps/web/package.json");
let pw; try { pw = require("playwright-core"); } catch { pw = require("playwright"); }
const out = "/home/user/Stablesaver/presentation/assets/screens";
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem("stablesave:onboarded:v1", "1"));
const page = await ctx.newPage();
await page.goto("http://localhost:3200/?amount=1000&asset=USDC", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.locator("[role=button]").filter({ hasText: /Best fit/i }).first().click();
await page.waitForTimeout(1000);
const dialog = page.getByRole("dialog");
await dialog.evaluate((d) => {
  const h = [...d.querySelectorAll("h3")].find((n) => n.textContent.includes("How risky"));
  h.scrollIntoView({ block: "start" });
  h.closest(".overflow-y-auto").scrollBy(0, -20);
});
await page.waitForTimeout(300);
await dialog.screenshot({ path: `${out}/04-detail-risk.png` });
await browser.close();
