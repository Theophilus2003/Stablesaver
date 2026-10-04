import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const app = createApp({ mode: "demo" });

describe("api", () => {
  it("reports health and mode", async () => {
    const res = await app.request("/health");
    expect(await res.json()).toMatchObject({ ok: true, mode: "demo" });
  });

  it("serves a labelled snapshot", async () => {
    const res = await app.request("/v1/opportunities?asset=USDT");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.mode).toBe("demo");
    expect(body.opportunities.length).toBeGreaterThan(0);
    expect(body.opportunities.every((o: { asset: string }) => o.asset === "USDT")).toBe(true);
  });

  it("estimates earnings for a profile", async () => {
    const res = await app.request("/v1/estimate?amount=10000&risk=safe");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await res.json()) as any;
    expect(body.estimated).toBe(true);
    expect(body.best.grade.startsWith("A")).toBe(true);
    expect(body.best.estimate.netEarnings).toBeGreaterThan(0);
    expect(body.vault.note).toMatch(/not a financial recommendation/i);
  });

  it("validates input", async () => {
    expect((await app.request("/v1/estimate?risk=yolo")).status).toBe(400);
    expect((await app.request("/v1/opportunities/nope")).status).toBe(404);
  });
});
