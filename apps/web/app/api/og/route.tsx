import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getNetwork, recommend } from "@stablesave/core";
import { ImageResponse } from "next/og";
import { WORDMARK_PATH } from "@/components/brand/logo";
import { getMarketSnapshot } from "@/lib/data/snapshot";
import { formatEarnings, formatPercent, formatUsd } from "@/lib/format";
import { parseAmountParam, parseAssetParam, parseRiskParam } from "@/lib/search-params";

/**
 * Share card (1200×630) for an estimate: /api/og?amount=10000&asset=USDC&risk=balanced.
 * The home page uses it as its preview image, so a shared link shows the estimate.
 */
const WIDTH = 1200;
const HEIGHT = 630;

const C = {
  ground: "#070a09",
  ink: "#f2f5f3",
  soft: "#d7e0db",
  muted: "#93a39b",
  green: "#3ddc97",
  amber: "#e2b55a",
};

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700; style: "normal" };
let fonts: Promise<Font[]> | undefined;

function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    ([400, 600, 700] as const).map(async (weight) => ({
      name: "Sora",
      data: await readFile(join(process.cwd(), "assets/fonts", `sora-${weight}.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const amount = parseAmountParam(url.searchParams.get("amount") ?? undefined);
  const asset = parseAssetParam(url.searchParams.get("asset") ?? undefined);
  const profile = parseRiskParam(url.searchParams.get("risk") ?? undefined);

  const snapshot = await getMarketSnapshot();
  const rec = recommend({ amount, asset, profile, opportunities: snapshot.opportunities });
  const pick = rec.best ?? rec.closest;
  const o = pick?.opportunity;
  const demo = snapshot.mode === "demo";

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          backgroundColor: C.ground,
          backgroundImage: "radial-gradient(circle at 50% -20%, rgba(61,220,151,0.30), rgba(7,10,9,0) 62%)",
          fontFamily: "Sora",
          color: C.ink,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="66" height="66" viewBox="0 0 24 24">
              <rect x="2.2" y="6.6" width="19.6" height="10.8" rx="5.4" fill={C.green} fillOpacity="0.14" stroke={C.green} strokeWidth="1.8" />
              <path d="M7.4 9.7v4.6M16.6 9.7v4.6" stroke={C.green} strokeWidth="1.4" strokeLinecap="round" strokeOpacity="0.6" />
              <circle cx="12" cy="12" r="3" fill={C.green} />
            </svg>
            <svg width={Math.round((34 * 537.1) / 77)} height="34" viewBox="0 0 537.1 77">
              <path d={WORDMARK_PATH} fill={C.ink} />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: 999,
              border: `1.5px solid ${demo ? "rgba(226,181,90,0.45)" : "rgba(61,220,151,0.45)"}`,
              color: demo ? C.amber : C.green,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: 3,
            }}
          >
            {demo ? "DEMO RATES" : "LIVE RATES"}
          </div>
        </div>

        {o && pick ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 36, color: C.muted }}>
              On {formatUsd(amount, { decimals: 0 })} {asset}, I could earn
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginTop: 6 }}>
              <div style={{ display: "flex", fontSize: 148, fontWeight: 700, color: C.green, letterSpacing: -6, lineHeight: 1 }}>
                {formatEarnings(pick.estimate.netEarnings)}
              </div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 600, color: C.soft }}>a year</div>
            </div>
            <div style={{ display: "flex", fontSize: 30, color: C.soft, marginTop: 22 }}>
              at {formatPercent(o.yield.totalApy)} on {o.protocolName} · {getNetwork(o.network, o.networkName).name} · grade{" "}
              {o.safety.display}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 700, letterSpacing: -4, lineHeight: 1.05 }}>
              What could your stablecoins earn?
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 24, color: C.muted }}>
          <div style={{ display: "flex" }}>Estimated after fees. Not a guarantee.</div>
          <div style={{ display: "flex", color: C.ink, fontWeight: 600 }}>{url.host}</div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: await loadFonts(),
      headers: { "Cache-Control": "public, max-age=0, s-maxage=600, stale-while-revalidate=3600" },
    },
  );
}
