# StableSave safety assessment (ss-safety-1.0)

`calculateSafetyGrade(opportunity)` in `packages/risk-engine` returns:

```ts
{
  grade: "A" | "B" | "C" | "D",
  modifier: "+" | "-" | "",
  display: "A-",
  score: 83,                 // 0–100
  label: "Safer",
  summary: "Lower relative risk based on …",
  reasons: string[],          // caps first, then weakest factors, then strongest
  factors: FactorAssessment[],
  caps: string[],
  methodologyVersion: "ss-safety-1.0",
}
```

It is a relative, opinionated assessment built from the inputs available. It is always presented as a
"StableSave safety assessment" and "Not a guarantee against loss."

## Factors and weights

| Factor | Weight | Inputs |
| --- | ---: | --- |
| Protocol maturity | 14 | months since mainnet launch |
| Total value locked | 12 | TVL (log scale) |
| Liquidity | 12 | available liquidity, utilization, withdrawal delay |
| Smart contract security | 14 | audits, bug bounty, upgrade authority, open source |
| Strategy complexity | 10 | simple / moderate / complex, leverage |
| Incident history | 12 | severity, losses, reimbursement, age (decays over 4 years) |
| Yield stability | 8 | 30-day APY standard deviation, share of rewards in the rate |
| Oracle dependencies | 9 | none / redundant / single feed, leverage |
| Concentration | 9 | top-10 depositor share, collateral concentration |

Each factor scores 0–100 by piecewise-linear interpolation (see `factors.ts`).

```
score = 0.75 × weighted average + 0.25 × weakest factor
```

## Hard caps

| Condition | Ceiling |
| --- | --- |
| Unreimbursed loss of user funds in the last 24 months | C |
| First-loss position (insurance fund) | C |
| No public audits | C |
| Live < 6 months | C+ |
| Single-key upgrade authority | C+ |
| Utilization ≥ 98% | B− |

## Grade scale

| Grade | Score | Label |
| --- | --- | --- |
| A / A− | 85–100 / 80–84 | Safer |
| B+ / B / B− | 75–79 / 70–74 / 65–69 | Moderate |
| C+ / C / C− | 60–64 / 55–59 / 50–54 | Riskier |
| D | 0–49 | High risk |

There is no A+.

## Vault strategies

`blendStrategy()` grades a vault strategy as `0.7 × weighted leg score + 0.3 × weakest leg − vaultLayerRiskPoints`
(4 points for the unaudited vault contract).

## Demo data

With demo fixtures the grades demonstrate the method only; they are not assessments of the named protocols.
Incident lists in the fixtures are intentionally empty: we don't attribute security history to real protocols from
invented data.
