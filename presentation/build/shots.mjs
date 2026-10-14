import { createRequire } from "module";
const require = createRequire("/home/user/Stablesaver/apps/web/package.json");
let pw; try { pw = require("playwright-core"); } catch { pw = require("playwright"); }
const out = "/home/user/Stablesaver/presentation/assets/screens";
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem("stablesave:onboarded:v1", "1"));
const page = await ctx.newPage();
const base = "http://localhost:3200";

await page.goto(`${base}/?amount=1000&asset=USDC`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/01-home-hero.png`, clip: { x: 430, y: 130, width: 580, height: 1030 }, fullPage: true });
await page.screenshot({ path: `${out}/02-options-list.png`, clip: { x: 296, y: 1392, width: 848, height: 1060 }, fullPage: true });

// Detail drawer for Kamino (best fit)
await page.locator("[role=button]").filter({ hasText: /Best fit/i }).first().click();
await page.waitForTimeout(1000);
const dialog = page.getByRole("dialog");
await dialog.screenshot({ path: `${out}/03-detail-rate.png` });
const scroller = dialog.locator(".overflow-y-auto").first();
const y = await scroller.evaluate((el) => { const h = [...el.querySelectorAll("h3")].find((n) => n.textContent.includes("How risky")); return h ? h.offsetTop - 12 : 0; });
await scroller.evaluate((el, top) => el.scrollTo(0, top), y);
await page.waitForTimeout(300);
await dialog.screenshot({ path: `${out}/04-detail-risk.png` });
await page.keyboard.press("Escape");

// $100 on Ethereum: fees outweigh a year of earnings
await page.goto(`${base}/?amount=100&asset=USDC`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.getByRole("radio", { name: /Ethereum/ }).click();
await page.waitForTimeout(600);
const opts = page.locator("#options");
const box = await opts.boundingBox();
await page.screenshot({ path: `${out}/05-fees-ethereum-100.png`, clip: { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: 250 }, fullPage: true });

// Vault withdraw flow (simulated preview in this build)
await page.goto(`${base}/vault/withdraw`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/06-vault-withdraw.png`, clip: { x: 470, y: 160, width: 500, height: 800 }, fullPage: true });
await page.goto(`${base}/vault`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/07-vault-strategies.png`, clip: { x: 296, y: 540, width: 848, height: 460 }, fullPage: true });
await browser.close();
console.log("done");
