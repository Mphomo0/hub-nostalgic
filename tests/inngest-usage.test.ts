import { describe, expect, it } from "vitest";
import { BASELINE_EXECUTIONS, EXECUTIONS_PER_MESSAGE, inngestUsageEstimate } from "@/lib/inngest/usage";

describe("inngestUsageEstimate", () => {
  it("is ok when well under the limit", () => {
    const e = inngestUsageEstimate(100, 50_000);
    expect(e.used).toBe(100 * EXECUTIONS_PER_MESSAGE + BASELINE_EXECUTIONS);
    expect(e.level).toBe("ok");
  });

  it("warns at 70% and goes critical at 90%", () => {
    expect(inngestUsageEstimate(12_000, 50_000).level).toBe("warning"); // 36,065 of 50,000
    expect(inngestUsageEstimate(15_000, 50_000).level).toBe("critical"); // 45,065 of 50,000
  });

  it("caps the percentage at 100", () => {
    expect(inngestUsageEstimate(1_000_000, 50_000).percent).toBe(100);
  });
});
