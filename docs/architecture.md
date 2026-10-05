# Architecture

```
               ┌──────────────────────────── packages ────────────────────────────┐
               │                                                                   │
 Market    ──▶ │ protocol-adapters ──▶ risk-engine ──▶ MarketSnapshot (core types)   │
 data          │  (DefiLlama: every     calculateSafetyGrade                        │
 (demo/live)   │   network; demo)                                                   │
               │                     core: recommend(), estimateEarnings(),         │
               │                           blendStrategy(), RISK_PROFILES           │
               └───────────────┬──────────────────────────────┬─────────────────────┘
                               │                              │
                     apps/web (server components)        apps/api (Hono)
                     getMarketSnapshot()                  /v1/opportunities …
                               │
                     client components: calculator, options, drawer, vault
                               │
                     packages/client (Codama) ──▶ stablesave_vault program (Anchor)
```

## Data flow

1. **Providers** (`packages/protocol-adapters`) implement `OpportunityProvider`:

   ```ts
   interface OpportunityProvider {
     id; name; mode;                                  // mode: "live" | "demo"
     listOpportunities(): Promise<Opportunity[]>;     // unrated, normalized
   }
   ```

   - **Live (default):** `DefiLlamaMarketsProvider` lists every single-asset USDC/USDT pool DefiLlama tracks, on
     every network (see below).
   - **Demo:** the four Solana vault-protocol adapters on fixtures, plus `DemoMultichainProvider` with a few
     illustrative options on other networks.

   The Solana protocols the vault allocates to (Kamino, MarginFi, Drift, Save) also have full
   `YieldProtocolAdapter`s, which extend `OpportunityProvider` with per-market questions and transaction builders:

   ```ts
   interface YieldProtocolAdapter extends OpportunityProvider {
     id: ProtocolId; network; supportedAssets; officialUrl; capabilities; source;
     getCurrentYield(marketId): Promise<number>;
     getLiquidity(marketId): Promise<number>;
     getRiskData(marketId): Promise<RiskData>;
     getDepositTransaction(params): Promise<Transaction>;
     getWithdrawTransaction(params): Promise<Transaction>;
   }
   ```

   Transaction builders throw `DirectDepositUnavailableError`, and the UI links to the official app instead.

2. **OpportunityService** collects every provider's opportunities, rates them with the **risk engine**, and returns
   a `MarketSnapshot { mode, generatedAt, opportunities, adapters, summary }` (`adapters` lists each provider's
   status). A failing provider is reported as `unavailable`; its markets are dropped, never replaced with
   placeholders. One demo provider makes the whole snapshot `mode: "demo"`.

3. **apps/web** loads the snapshot in server components (in-process, or from `apps/api` when `STABLESAVE_API_URL` is
   set) and passes it to client components. The calculator runs `recommend()` on every keystroke:
   - filters by asset and risk profile (`minGrade`, max share of available liquidity) and drops options whose
     network fees cost more than they'd earn at this amount,
   - ranks by `safetyWeight × score + yieldWeight × relative kept yield` (yield after fees, so a cheap network can
     beat a slightly higher rate on Ethereum for small amounts),
   - estimates earnings with `estimateEarnings()` = amount × APY − deposit/withdrawal fees − network fees,
   - when nothing meets the profile's minimum grade, returns the safest workable option as `closest`, which the UI
     marks as below the setting.

4. **Vault** pages use `useVault()`:
   - **Simulated** (no program configured): state in `localStorage`, balances compounding at today's blended APY,
     withdrawal limits and timelocks mirroring the program's defaults. Always labelled.
   - **On-chain**: reads `Vault` / `UserPosition` accounts with the Codama client over `@solana/kit` RPC; builds
     instructions with `buildDepositInstruction` / `buildWithdrawPlan`; converts them with `toWeb3JsInstructions` and
     sends them through Solana Wallet Adapter.

## Strategy configuration

`packages/core/src/strategies.ts` defines `VaultStrategy` (profile, allocations in basis points, management fee,
vault-layer risk points) with `validateStrategy()` mirroring the on-chain rules and `blendStrategy()` for blended
APY and grade. `EXAMPLE_VAULT_STRATEGIES` are labelled `source: "example"`; when a vault is deployed the UI reads the
weights from the vault account instead (`strategyFromVault`).

## Live data (DefiLlama)

`packages/protocol-adapters/src/live/` reads DefiLlama's public, keyless API:

| Endpoint | Used for |
| --- | --- |
| `yields.llama.fi/pools` | supply APY (base + rewards), pool size, pool name, chain, APY standard deviation (`sigma`) |
| `yields.llama.fi/lendBorrow` | total supplied / borrowed → TVL, available liquidity, utilization |
| `api.llama.fi/protocols` | name, logo, website, category, listing date (maturity), audit links, oracle providers |

`DefiLlamaMarketsProvider` keeps pools that are:

- on any chain, with symbol `USDC`, or `USDT` / `USDT0` (Tether's omnichain USDT); bridged copies such as `USDC.e`
  are left out, and on Solana the pool must use the canonical mint,
- single exposure, not flagged as an outlier, with an APY between 0 and 50%,
- at least $1M deposited; the 60 largest per stablecoin.

Each pool becomes an opportunity with id `{protocol}-{network}-{market}-{asset}`. Pools from the vault protocols'
DefiLlama projects (`DEFILLAMA_PROJECTS`: `kamino-lend`, `marginfi-lending`, `drift-trade`, `save`, plus older
names) get the vault protocol id (`kamino`, …) and StableSave's curated official links; every other project keeps its
DefiLlama slug, and its website comes from DefiLlama's listing. The strategy type comes from DefiLlama's category
(lending, curated vault, or other yield).

Network fees come from `getNetwork()` in `packages/core/src/networks.ts`: a rough USD cost of one deposit plus one
withdrawal per chain (Ethereum ~$12, L2s and Solana cents, unlisted chains $1). They are estimates, labelled as such.

`/pools` is cached for 10 minutes; `/protocols` for 6 hours. `/pools` failing makes the provider `unavailable`; the
other endpoints are optional enrichment, and missing values stay `null`.

Not available from DefiLlama, so `null` / `"unknown"` and labelled "not verified": bug bounty, upgrade authority,
open-source status, incident review, depositor and collateral concentration.

`STABLESAVE_DEFILLAMA_YIELDS_URL` / `STABLESAVE_DEFILLAMA_API_URL` point the client at a proxy or mirror.

To add a richer source later (e.g. Kamino's SDK for per-reserve data), implement `OpportunityProvider` (or a
`MarketDataSource` behind a protocol adapter) and add it in `createDefaultProviders()`.

## Design system

`packages/ui` holds the primitives (Button, Card/Panel, Badge, GradeBadge, SegmentedControl, PillTabs,
AnimatedNumber, Sheet/Dialog, AllocationBar, ProtocolMark). Tokens live in `apps/web/app/globals.css` (`@theme`):
near-black canvas, charcoal surfaces, hairline borders, one typeface (Geist Sans) with tabular numbers, a restrained
green for earnings, and a 1px Solana gradient as the only flourish. Motion is short and respects reduced-motion.
