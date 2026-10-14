import { describe, expect, it } from "vitest";
import { TREASURY_BILLS_URL, parseTreasuryBills } from "./index";

describe("parseTreasuryBills", () => {
  it("reads the newest Treasury Bills row", () => {
    const b = parseTreasuryBills({
      data: [{ record_date: "2026-09-30", security_desc: "Treasury Bills", avg_interest_rate_amt: "3.912" }],
      meta: { count: 1 },
    });
    expect(b).not.toBeNull();
    expect(b!.rate).toBeCloseTo(0.03912, 6);
    expect(b!.asOf).toBe("2026-09-30");
    expect(b!.mode).toBe("live");
  });

  it("skips other securities and bad values", () => {
    expect(parseTreasuryBills({ data: [{ record_date: "2026-09-30", security_desc: "Treasury Notes", avg_interest_rate_amt: "3.5" }] })).toBeNull();
    expect(parseTreasuryBills({ data: [{ record_date: "2026-09-30", security_desc: "Treasury Bills", avg_interest_rate_amt: "null" }] })).toBeNull();
    expect(parseTreasuryBills({ data: [{ record_date: "Sept", security_desc: "Treasury Bills", avg_interest_rate_amt: "3.5" }] })).toBeNull();
    expect(parseTreasuryBills({ error: "bad request" })).toBeNull();
    expect(parseTreasuryBills(null)).toBeNull();
  });

  it("asks only for Treasury Bills, newest first", () => {
    expect(TREASURY_BILLS_URL).toContain("filter=security_desc:eq:Treasury%20Bills");
    expect(TREASURY_BILLS_URL).toContain("sort=-record_date");
  });
});
