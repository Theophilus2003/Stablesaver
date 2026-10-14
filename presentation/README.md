<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../apps/web/public/brand/stablesave-logo-dark.svg">
  <img src="../apps/web/public/brand/stablesave-logo-light.svg" alt="StableSave" width="180">
</picture>

# StableSave — Demo Day deck

| File | What it is |
| --- | --- |
| `StableSave-Demo-Day.pptx` | The editable deck: 18 slides, 16:9, with speaker notes on every slide |
| `StableSave-Demo-Day.pdf` | The same deck as a PDF with all three fonts embedded (use it as the backup) |
| `assets/fonts/` | Anton, Archivo and IBM Plex Mono (free, SIL Open Font License). **Install them before opening the PPTX** |
| `assets/screens/` | Screenshots of the real StableSave interface used in the deck |
| `assets/graphics/` | Logo, QR code, cover collage, stickers and the star bullet (all original) |
| `assets/previews/` | One image per slide, for a quick look without opening the deck |
| `build/` | The scripts that generate the artwork and the deck; speaker notes are in `build/notes.json` |

Source of truth: *StableSave — Project Review Guide*. Technical details were also checked against the code.

## The look

A scrapbook "class notes" style on a charcoal background:

- **Headings** in Anton capitals on a green paint blob (each blob is drawn to fit its heading).
- **Labels** in IBM Plex Mono: the `STABLESAVE · DEMO DAY` line at the top, card labels, the page counter
  (`04 / 18`), and short notes in tinted strips with a coloured edge.
- **Text** in Archivo, with the key phrase in each subtitle in bold white.
- **Tilted cards** with a hard shadow for big numbers (grades, fees, roadmap phases) and strips of coloured tape
  for status labels.
- **Stickers** (coin, sprout, shield, piggy bank, vault, sparkle) on the cover, agenda, chapter and closing slides.
- **Three chapters**, each opened by a chapter slide: the comparison app, the Solana vault, demo and what's next.

## Structure and timing (about 8½ minutes, demo separate)

| # | Slide | Message | Time |
| --- | --- | --- | --- |
| 1 | StableSave (cover) | Who, what, and the two separate parts | 0:20 |
| 2 | Yield is easy to find | The headline rate hides risk and cost | 0:40 |
| 3 | Agenda | Three parts: the app, the vault, demo and what's next | 0:10 |
| 4 | Chapter 01 · The comparison app | Live today | 0:05 |
| 5 | One place to compare | The flow in six steps; no wallet; never holds funds | 0:35 |
| 6 | From balance to decision | Annotated walkthrough of real screens | 0:45 |
| 7 | How the grade works | Nine weighted factors, 75/25 scoring, grade bands, caps | 0:50 |
| 8 | The return after costs | $100 on Ethereum: fees outweigh a year's interest | 0:35 |
| 9 | Four more questions | Idle-money scan, withdraw today, US T-bill comparison, share card | 0:35 |
| 10 | Chapter 02 · The Solana vault | A separate devnet prototype | 0:05 |
| 11 | The vault program | Wallet → program checks → Vault / Reserve + pools / UserPosition PDAs | 0:50 |
| 12 | Every deposit, split | Pools card, deposit Blink, the CI rehearsal (100 in → 80/20 → withdraw 40) | 0:35 |
| 13 | Security is trade-offs | Eight controls, each with its trade-off; what's not done | 0:40 |
| 14 | Chapter 03 · Demo & what's next | What works, what's missing, what's next | 0:05 |
| 15 | Let's see it work | Demo runbook: A live app, B devnet vault | 0:15 (+3–4 min demo) |
| 16 | Live, devnet, not yet | Status matrix and known limitations | 0:35 |
| 17 | What comes next | Four planned phases | 0:30 |
| 18 | Thank you! | Closing line, QR code, feedback ask | 0:25 |

Short on time? Click straight through the agenda and chapter slides, cut slides 9 and 12 to one sentence each (the
demo shows the same features), and reduce slide 13 to its "Not yet" line.

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
6. **Try it** on the Vault page's "Deposit from a link" card: the same deposit, drawn from the Solana Action that
   Blink clients read. **Copy link** gives the dial.to link to share.

Say out loud: devnet tokens have no value, and the practice pools pay fixed practice rates, not market yield.

## Assumptions to check before presenting

- **Fonts.** The deck uses Anton (headings), Archivo (text) and IBM Plex Mono (labels). Install the five files in
  `assets/fonts/` (double-click each, then Install) on the presenting computer before opening the PPTX, or
  PowerPoint will substitute other fonts and the layout will shift. They're also on Google Fonts. The PDF already
  embeds them. In Google Slides, all three are in the font menu.
- **Screenshots use demo data.** They are the real interface, captured from a local build in demo mode, because the live site couldn't be reached from the build environment. Each one is labelled. If you'd rather show live numbers, take the same screenshots from the live site and replace the files in `assets/screens/` (same names), then rebuild.
- **The vault thumbnail (slide 15) shows the simulated preview.** With the devnet variables set, the live site shows the same screen sending real devnet transactions.
- **Protocol logos show initials in the screenshots.** The build environment couldn't reach DefiLlama's logo server. The live site loads the real logos.
- **Slide 7's example comes from the demo data.** Kamino JLP Market: weighted average 81, concentration 37, final score 70 (grade B). The arithmetic is 0.75 × 81 + 0.25 × 37 ≈ 70.
- **Slide 8's Solana card is illustrative.** It uses the same 4.10% rate with StableSave's Solana fee estimate ($0.02). The Ethereum card matches the screenshot ($12 estimate, −$7.90).
- **Slide 9's wallet scan used a stand-in balance** ($1,240.51 USDC and $300 USDT), because the build environment
  couldn't reach Solana mainnet. The T-bill chart uses the demo figure (4.00%); the live site uses the US Treasury's
  latest average rate. The share card was rendered by the site's own `/api/og` route; only its corner domain was set
  to `stablesaver-web.vercel.app`, since the local build printed `localhost`.
- **Slide 12's pools card shows the CI rehearsal's numbers** (100 deposited: 20 kept liquid; 36, 24 and 20 in the
  Kamino, MarginFi and Save practice pools), drawn by the real component. The chart and checks come from the
  "Vault program" GitHub Actions run on `main`: deposit 100 → 80 in three pools and 20 liquid; withdraw 40 → the
  20 short came from the pools; wallet 940, pools 60.
- **Panel headings changed.** The review guide mentions "Why this grade?" and "What could go wrong?". The current interface shows "How risky is it?" plus a risk note, and the deck uses the current headings.
- **QR code:** links to `https://stablesaver-web.vercel.app`, verified by decoding the image.

## Rebuild

```bash
cd presentation/build
npm install
npm run brand      # logo files for the site, docs and deck (apps/web/public/brand)
npm run deck       # artwork (blobs, stickers, cover collage) and ../StableSave-Demo-Day.pptx
```

`art.js` draws the artwork; `node art.js <folder>` writes previews of it. Speaker notes live in `notes.json`.
Install the fonts in `assets/fonts/` before exporting the PDF, so LibreOffice or PowerPoint embeds the right ones.

The QR code was made with Python (`pip install qrcode pillow opencv-python-headless`):

```python
import qrcode
qrcode.make("https://stablesaver-web.vercel.app").save("assets/graphics/qr-stablesaver.png")
```

Export a PDF from PowerPoint (File → Export → PDF), or with LibreOffice: `soffice --headless --convert-to pdf StableSave-Demo-Day.pptx`.
