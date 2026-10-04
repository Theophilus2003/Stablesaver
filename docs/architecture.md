# Architecture

```
               ┌──────────────────────────── packages ────────────────────────────┐
               │                                                                   │
 Protocol  ──▶ │ protocol-adapters ──▶ risk-engine ──▶ MarketSnapshot (core types)   │
 data          │  (Kamino, MarginFi,    calculateSafetyGrade                        │
 (demo/live)   │   Drift, Save)                                                     │
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

1. **Adapters** (`packages/protocol-adapters`) implement `YieldProtocolAdapter`:

   ```ts
   interface YieldProtocolAdapter {
     id; name; network; supportedAssets; officialUrl; capabilities; source;
     listOpportunities(): Promise<Opportunity[]>;
     getCurrentYield(marketId): Promise<number>;
     getLiquidity(marketId): Promise<number>;
     getRiskData(marketId): Promise<RiskData>;
     getDepositTransaction(params): Promise<Transaction>;
     getWithdrawTransaction(params): Promise<Transaction>;
   }
   ```

   Markets come from a `MarketDataSource`: `DemoMarketSource` (fixtures) or `LiveMarketSource` (throws
   `LiveDataUnavailableError` until integrated). Transaction builders throw `DirectDepositUnavailableError`, and the
   UI links to the official app instead.

2. **OpportunityService** collects every adapter's markets, rates them with the **risk engine**, and returns a
   `MarketSnapshot { mode, generatedAt, opportunities, adapters, summary }`. A failing adapter is reported as
   `unavailable`; its markets are dropped, never replaced with placeholders. One demo source makes the whole snapshot
   `mode: "demo"`.

3. **apps/web** loads the snapshot in server components (in-process, or from `apps/api` when `STABLESAVE_API_URL` is
   set) and passes it to client components. The calculator runs `recommend()` on every keystroke:
   - filters by asset and risk profile (`minGrade`, max share of available liquidity),
   - ranks by `safetyWeight × score + yieldWeight × relative APY`,
   - estimates earnings with `estimateEarnings()` = amount × APY − deposit/withdrawal fees − network fees.

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

## Going live with protocol data

Implement a `MarketDataSource` per protocol in `packages/protocol-adapters/src/live/` returning `ProtocolMarket[]`:

| Protocol | Suggested source |
| --- | --- |
| Kamino | `@kamino-finance/klend-sdk` reserves (supply APY, available liquidity, utilization) |
| MarginFi | `@mrgnlabs/marginfi-client-v2` banks |
| Drift | `@drift-labs/sdk` spot markets and insurance fund |
| Save | `@solendprotocol/solend-sdk` or the Save API |

Add an indexer for 30-day APY history and curate incident records with citations. Then set
`STABLESAVE_DATA_MODE=live`.

## Design system

`packages/ui` holds the primitives (Button, Card/Panel, Badge, GradeBadge, SegmentedControl, PillTabs,
AnimatedNumber, Sheet/Dialog, AllocationBar, ProtocolMark). Tokens live in `apps/web/app/globals.css` (`@theme`):
near-black canvas, charcoal surfaces, hairline borders, one typeface (Geist Sans) with tabular numbers, a restrained
green for earnings, and a 1px Solana gradient as the only flourish. Motion is short and respects reduced-motion.
