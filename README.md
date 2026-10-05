# StableSave

See what your idle USDC and USDT could earn across networks, compare yield, fees and risk, and choose where your money
goes.

StableSave is a stablecoin savings and yield-discovery app. Enter an amount, pick a risk level, and see an estimated
yearly return after fees (network fees included), an A–D safety grade, and the options that fit, on every network
DefiLlama tracks: Ethereum, Solana, Arbitrum, Base, BSC, Avalanche, Plasma and more. Deposit directly on the official
protocol, or use the StableSave Vault, which splits one deposit across Solana protocols.

> **Status:** market data is **live from DefiLlama** by default (rates, deposits, liquidity, rate stability and
> protocol metadata for every USDC/USDT pool on every network), with labelled demo fixtures available offline. The vault program is written and tested on the
> host but **not deployed**, so the vault UI runs as a labelled **simulated preview** until you configure a deployed
> program. Nothing here is financial advice.

## Quick start

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Market data comes live from DefiLlama's public API (no key). Offline, or to use the illustrative fixtures:
`STABLESAVE_DATA_MODE=demo pnpm dev`.

Optional API: `pnpm dev:api` (http://localhost:4000), then set `STABLESAVE_API_URL=http://localhost:4000` for the web app.

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm dev:api` | Run the web app / API |
| `pnpm build` | Production build of every package and app |
| `pnpm typecheck` | TypeScript across the monorepo |
| `pnpm test` | Vitest across the TypeScript packages |
| `pnpm program:test` | Rust unit + LiteSVM integration tests for the vault program |
| `pnpm idl:build` | Regenerate `idl/stablesave_vault.json` from the program (needs Anchor CLI) |
| `pnpm generate:client` | Regenerate the Codama client from the IDL |

## Deploying to Vercel

Import the repo and create **one project per app** ("Import single project"), not the multi-service preset:

| Project | Root Directory | Notes |
| --- | --- | --- |
| Website | `apps/web` | Next.js, auto-detected. No environment variables required. |
| API (optional) | `apps/api` | `apps/api/vercel.json` bundles the Hono app with esbuild into a single function (Build Output API). The website doesn't need it. |

Keep "Include files outside of the root directory in the Build Step" enabled; both apps import `packages/*`.

## Demo data, devnet and mainnet

Three separate things, each visible in the UI:

| Setting | Env var | Default | UI label |
| --- | --- | --- | --- |
| Market data source | `STABLESAVE_DATA_MODE` = `live` \| `demo` | `live` (DefiLlama) | **Live data** / **Demo data** badge, "Live rates" / "Demo rates" eyebrow, per-option source note and DefiLlama link |
| Solana cluster | `NEXT_PUBLIC_SOLANA_CLUSTER` = `devnet` \| `mainnet-beta` \| `localnet` | `devnet` | **Devnet** / **Mainnet** badge on vault pages |
| Vault deployment | `NEXT_PUBLIC_STABLESAVE_VAULT_PROGRAM_ID` + `NEXT_PUBLIC_STABLESAVE_VAULT_MINT` | unset | **Preview** + "Simulated" banners until both are set |

`live` mode never falls back to demo numbers: if DefiLlama can't be reached, the data source reports as unavailable
and the UI says so. Risk inputs DefiLlama doesn't provide (bug bounties, upgrade controls, incident history,
concentration) are shown as **not verified** and scored conservatively. Network fees are per-chain estimates (see
the Data sources page). See `apps/web/.env.example`.

## Repository layout

```
apps/
  web/                      Next.js 16 app (Tailwind v4, Radix, Motion, Solana Wallet Adapter)
  api/                      Hono API: /v1/opportunities, /v1/estimate, /v1/strategies
programs/
  stablesave-vault/         Anchor 1.2 program (Rust) + LiteSVM tests
packages/
  core/                     Domain types, earnings math, risk profiles, vault strategy config, recommendations
  risk-engine/              calculateSafetyGrade() → { grade, score, reasons, factors, caps }
  protocol-adapters/        All-network DefiLlama provider, Kamino / MarginFi / Drift / Save adapters, OpportunityService
  client/                   Codama-generated TS client for the vault + hand-written helpers
  ui/                       Design-system primitives (shadcn/ui-style)
idl/stablesave_vault.json   Anchor IDL (input to Codama)
scripts/generate-client.mjs Codama generation
docs/                       Architecture, vault program, risk methodology
```

## The main flow

1. **What are you saving?** Amount + USDC/USDT, quick amounts.
   Options on every network, filterable by network, with each network's fees counted in the estimate.
2. **How much risk are you okay with?** Play it safe · Balanced · Go bigger.
3. **You could earn** `amount × estimated APY − fees`, labelled *Estimated*, with the grade and protocol.
4. **Here's why**: tap the protocol for the detail drawer: APY, earnings, grade with reasons and all nine factors,
   liquidity, TVL, fees, where the money goes, what could go wrong, and **Deposit on official app**.
5. **Or split it** with the StableSave Vault (blended APY and grade) → three-step deposit → dashboard → withdrawals
   with the large-withdrawal timelock.

Everything is computed from the data layer: nothing in the UI is a hard-coded rate or earnings figure.

## Docs

- [Architecture](docs/architecture.md): packages, data flow, adapter interface, going live
- [Vault program](docs/vault-program.md): accounts, PDAs, instructions, safety controls, build/test/deploy
- [Risk methodology](docs/risk-methodology.md): factors, weights, caps, grade scale
- [Client](packages/client/README.md): using the Codama client

## Known gaps

- Risk inputs beyond DefiLlama's data (bug bounties, upgrade authority, incident history, concentration) aren't
  sourced yet; they show as "not verified". Network fees are per-chain estimates, not live gas prices.
- Protocol websites for non-vault protocols come from DefiLlama's listing, not a StableSave-curated list.
- Vault allocation: the program stores and validates strategy weights, but funds stay in the vault reserve. The
  allocator that deploys into Kamino / MarginFi / Drift / Save via CPI is the next milestone.
- The vault program is unaudited. The SBF build and LiteSVM tests need the Solana toolchain (`anchor build`).
- Direct deposits link out to the official apps; adapters don't build protocol transactions yet.
