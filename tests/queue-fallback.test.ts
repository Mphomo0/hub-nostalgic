import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const deliverInitial = vi.fn();
const afterCallbacks: Array<() => unknown> = [];

vi.mock("next/server", () => ({ after: (cb: () => unknown) => afterCallbacks.push(cb) }));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send }, inngestEnabled: () => true }));
vi.mock("@/modules/reviews/lib/deliver", () => ({ deliverInitial, handleWhatsAppDeliveryFailure: vi.fn() }));

const { enqueueSends } = await import("@/modules/reviews/lib/queue");

describe("enqueueSends fallback", () => {
  beforeEach(() => {
    send.mockReset();
    deliverInitial.mockReset();
    afterCallbacks.length = 0;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("only uses Inngest when it accepts the events", async () => {
    send.mockResolvedValue(undefined);
    await enqueueSends(["a", "b"]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("sends directly when Inngest refuses the events", async () => {
    send.mockRejectedValue(new Error("over limit"));
    await enqueueSends(["a", "b"]);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(deliverInitial.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });

  it("only falls back for the batches that failed", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `r${i}`);
    send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("down"));
    await enqueueSends(ids);
    await afterCallbacks[0]();
    expect(deliverInitial).toHaveBeenCalledTimes(50); // the second batch (r100..r149)
  });
});
