<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../apps/web/public/brand/stablesave-logo-dark.svg">
  <img src="../apps/web/public/brand/stablesave-logo-light.svg" alt="StableSave" width="180">
</picture>

# StableSave — Demo Day deck

| File | What it is |
| --- | --- |
| `StableSave-Demo-Day.pptx` | The editable deck: 14 slides, 16:9, with speaker notes on every slide |
| `StableSave-Demo-Day.pdf` | The same deck as a PDF, with the Inter font embedded (use it as the backup) |
| `assets/screens/` | Screenshots of the real StableSave interface used in the deck |
| `assets/graphics/` | Logo (mark and full logo), cover art, content background and the QR code (all original) |
| `assets/previews/` | One image per slide, for a quick look without opening the deck |
| `build/` | The scripts that generate the graphics and the deck |

Source of truth: *StableSave — Project Review Guide*. Technical details were also checked against the code.

## Structure and timing (about 8 minutes, demo separate)

| # | Slide | Message | Time |
| --- | --- | --- | --- |
| 1 | Know the risk before you chase the yield | Who, what, and the two separate parts | 0:20 |
| 2 | Finding yield is easy… | The headline rate hides risk and cost | 0:40 |
| 3 | One place to compare… | The flow in six steps; no wallet; never holds funds | 0:35 |
| 4 | From a balance to a more informed decision | Annotated walkthrough of real screens | 0:45 |
| 5 | A high APY should never tell the whole story | Nine weighted factors, 75/25 scoring, grade bands, caps | 0:50 |
| 6 | The return that matters is the return after costs | $100 on Ethereum: fees outweigh a year's interest | 0:35 |
| 7 | Four more questions answered before you deposit | Idle-money scan, withdraw today, US T-bill comparison, share card | 0:35 |
| 8 | A separate Anchor vault prototype… | Wallet → program checks → Vault / Reserve + pools / UserPosition PDAs | 0:50 |
| 9 | The vault now splits every deposit, and a test proves it | Pools card, deposit Blink, the CI rehearsal (100 in → 80/20 → withdraw 40) | 0:35 |
| 10 | Security is not a badge… | Eight controls, each with its trade-off; what's not done | 0:40 |
| 11 | Let's see what works today | Demo runbook: A live app, B devnet vault | 0:15 (+3–4 min demo) |
| 12 | What is live, what is experimental… | Status matrix and known limitations | 0:35 |
| 13 | From useful comparison tool… | Four planned phases | 0:30 |
| 14 | Make stablecoin yield easier to understand… | Contributions, QR code, feedback ask | 0:25 |

Short on time? Slides 7 and 9 can be cut to one sentence each (the demo shows the same features), and slide 10
can be reduced to the "Not yet" line.

## Demo runbook

**Before the talk**
- Vercel has `NEXT_PUBLIC_SOLANA_CLUSTER=devnet`, the program id and the test-token mint set, and the site has been redeployed. The Vault page should show **Devnet**, not **Preview**.
- The **Vault program** workflow has run since practice pools were added (it upgrades the program and opens the pools).
- Solflare is on devnet, holds test tokens and a little devnet SOL. Do one full dry run.
- Have the PDF open as a backup in case the network fails.

**Part A — live comparison app** (stablesaver-web.vercel.app)
1. Open the site (no wallet or sign-up). Click **Find idle money in my wallet** and paste a wallet address: it reads
   the USDC and USDT on Solana, read-only, and fills the calculator.
2. Switch Play it safe → Balanced → Go bigger.
3. Open the top option: drag across the rate chart, then show **Can I withdraw today?** and **How risky is it?**.
4. Point at the **For comparison** row: US Treasury bills, from the US Treasury's own data.
5. Enter $100 and pick Ethereum. If live data still shows one, an option is marked "Fees cost more than you'd earn".
   If not, say so and move on.
6. Click **Share my estimate**: the link previews as a card with the estimate.

**Part B — devnet vault**
1. Show the wallet is on devnet, open Vault (badge: Devnet) and connect.
2. Deposit test tokens and approve: the same transaction splits the deposit into the practice pools.
3. **Where the vault's money is**: 20% kept liquid, the rest in a pool per protocol, read from the chain.
4. **Collect interest & rebalance**: anyone can press it; it only moves money toward the on-chain strategy.
5. Withdraw more than the reserve holds: the program pulls the difference from the pools. Above 2,000 the rest
   waits 30 minutes (don't wait live).
6. **Open Blink** on the Vault page: the same deposit from a link or QR code.

Say out loud: devnet tokens have no value, and the practice pools pay fixed practice rates, not market yield.

## Assumptions to check before presenting

- **Screenshots use demo data.** They are the real interface, captured from a local build in demo mode, because the live site couldn't be reached from the build environment. Each one is labelled "local build, demo data". If you'd rather show live numbers, take the same screenshots from the live site and replace the files in `assets/screens/` (same names), then rebuild.
- **The vault thumbnail (slide 11) shows the simulated preview.** With the devnet variables set, the live site shows the same screen sending real devnet transactions.
- **Protocol logos show initials in the screenshots.** The build environment couldn't reach DefiLlama's logo server. The live site loads the real logos.
- **Slide 5's example comes from the demo data.** Kamino JLP Market: weighted average 81, concentration 37, final score 70 (grade B). The arithmetic is 0.75 × 81 + 0.25 × 37 ≈ 70.
- **Slide 7's wallet scan used a stand-in balance** ($1,240.51 USDC and $300 USDT), because the build environment
  couldn't reach Solana mainnet. The T-bill chart uses the demo figure (4.00%); the live site uses the US Treasury's
  latest average rate. The share card was rendered by the site's own `/api/og` route; only its corner domain was set
  to `stablesaver-web.vercel.app`, since the local build printed `localhost`.
- **Slide 9's pools card shows the CI rehearsal's numbers** (100 deposited: 20 kept liquid; 36, 24 and 20 in the
  Kamino, MarginFi and Save practice pools), drawn by the real component. The chart and checks come from the
  "Vault program" GitHub Actions run on `main`: deposit 100 → 80 in three pools and 20 liquid; withdraw 40 → the
  20 short came from the pools; wallet 940, pools 60.
- **Slide 6's Solana row is illustrative.** It uses the same 4.10% rate with StableSave's Solana fee estimate ($0.02). The Ethereum row matches the screenshot ($12 estimate, −$7.90).
- **Panel headings changed.** The review guide mentions "Why this grade?" and "What could go wrong?". The current interface shows "How risky is it?" plus a risk note, and the deck uses the current headings.
- **Font:** the deck uses Inter. Install it from Google Fonts (free) on the presenting computer, or PowerPoint will substitute a different font and spacing may shift. The PDF already embeds it.
- **QR code:** links to `https://stablesaver-web.vercel.app`, verified by decoding the image.

## Rebuild

```bash
cd presentation/build
npm install
npm run brand      # logo files for the site, docs and deck (apps/web/public/brand)
npm run graphics   # deck logo, backgrounds (QR code: see below)
npm run deck       # writes ../StableSave-Demo-Day.pptx
```

The QR code was made with Python (`pip install qrcode pillow opencv-python-headless`):

```python
import qrcode
qrcode.make("https://stablesaver-web.vercel.app").save("assets/graphics/qr-stablesaver.png")
```

Export a PDF from PowerPoint (File → Export → PDF), or with LibreOffice: `soffice --headless --convert-to pdf StableSave-Demo-Day.pptx`.
